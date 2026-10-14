const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ranking=require("../recommendations");
const source=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const functions=source.slice(source.indexOf("function forYouSignature()"),source.indexOf("function forYouRail("));
function setup() {
 const profiles={a:{id:"a",preferences:{favoriteGenres:[28]},likedTitles:[{id:901,type:"movie",genreIds:[28],likedAt:new Date().toISOString()}],hiddenTitles:[{id:1,type:"movie"}]},b:{id:"b",preferences:{favoriteGenres:[35]},likedTitles:[{id:902,type:"movie",genreIds:[35],likedAt:new Date().toISOString()}],hiddenTitles:[]}};
 const calls=[],context={state:{catalog:{},route:"home"},active:"a",window:{SEVENRecommendations:ranking},Date,JSON,Set,Promise,Number,String,Object,Array,
  activeProfileId:()=>context.active,currentProfile:()=>profiles[context.active],currentPreferences:()=>profiles[context.active].preferences,
  historyEntries:()=>[],likedTitles:()=>profiles[context.active].likedTitles,hiddenTitles:()=>profiles[context.active].hiddenTitles,restrictedTitles:()=>[],useFamilyCatalog:()=>!!profiles[context.active].kids,
  contentAllowed:item=>!profiles[context.active].hiddenTitles.some(hidden=>hidden.type===item.type&&hidden.id===item.id),contentType:item=>item.type||item.media_type,normalize:(item,type)=>({...item,type:item.type||item.media_type||type}),render:()=>{},
  api:async (endpoint,params)=>{calls.push({endpoint,params});const type=endpoint.includes("tv")?"tv":"movie";return {results:Array.from({length:24},(_,i)=>({id:i+1,type,title:`Title ${i+1}`,genre_ids:[i%2?35:type==="tv"?10759:28],poster_path:"/poster.png",release_date:"2025-01-01",vote_average:8,vote_count:500,popularity:20}))};}
 };
 vm.createContext(context);vm.runInContext(functions,context);return {context,profiles,calls};
}
test("For You fetches profile taste and recommendations, then ranks full snapshots rather than popularity pages",async()=>{
 const {context,calls}=setup();await context.openForYou();const view=context.state.forYou;
 assert.equal(view.loading,false);assert.equal(view.profileId,"a");assert.ok(view.rails["Movies for you"][0].genre_ids.includes(28));assert.ok(!view.rails["Movies for you"].some(item=>item.id===1));
 assert.ok(calls.some(call=>call.endpoint==="movie/901/recommendations"));assert.ok(calls.some(call=>call.endpoint==="discover/tv"&&call.params.with_genres==="10759"));
 assert.equal(view.sources["Movies for you"].length,0);assert.ok(view.rails["Movies for you"].length>20);
 context.active="b";await context.openForYou();assert.ok(context.state.forYou.rails["Movies for you"][0].genre_ids.includes(35));
});
test("disabled content types never trigger requests and a broken source does not erase working sources",async()=>{
 const {context,profiles,calls}=setup();profiles.a.preferences.contentMix="series";
 const real=context.api;context.api=(endpoint,params)=>params.page===2?Promise.reject(Error("Offline")):real(endpoint,params);
 await context.openForYou();assert.ok(!calls.some(call=>call.endpoint.includes("movie")));assert.ok(context.state.forYou.rails["Series for you"].length);assert.equal(context.state.forYou.error,undefined);
});
test("stale requests cannot replace another profile’s For You state",async()=>{
 const {context}=setup();context.api=async()=>{context.active="b";context.state.forYou={profileId:"b",rails:{}};return {results:[]};};
 await context.openForYou();assert.equal(context.state.forYou.profileId,"b");assert.equal(context.state.forYou.loading,undefined);
});
test("the cache signature changes for ratings, history, family restrictions and profile preferences",()=>{
 const {context,profiles}=setup();const initial=context.forYouSignature();profiles.a.preferences.favoriteGenres=[35];assert.notEqual(context.forYouSignature(),initial);
 const changed=context.forYouSignature();profiles.a.kids=true;assert.notEqual(context.forYouSignature(),changed);
 const family=context.forYouSignature();profiles.a.likedTitles=[];assert.notEqual(context.forYouSignature(),family);
});
