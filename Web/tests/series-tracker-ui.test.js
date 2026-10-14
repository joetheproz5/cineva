const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const tracker=require("../series-tracker");
const source=fs.readFileSync(path.resolve(__dirname,"../series-tracker-ui.js"),"utf8");
function setup(){
 const stored=new Map(),calls=[],context={active:"main",owner:"user",state:{session:{access_token:"fixture"},accountProgress:[],watchlist:[],watchlistOwnerId:"user",watchlistProfileId:"main"},Date,JSON,Number,String,Object,Array,Map,Set,Promise,Uint8Array,TextEncoder,crypto:global.crypto,clearTimeout,setTimeout,
  document:{addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  accountWatchlistUserId:()=>context.owner,activeProfileId:()=>context.active,currentPreferences:()=>({}),contentType:item=>item.type,listItems:()=>[],progressEntries:()=>[],restrictedTitles:()=>[],hiddenTitles:()=>[],releaseDeviceToken:()=>null,
  watchKey:item=>`seven-progress-${context.active}-${item.type}-${item.id}-${item.season}-${item.episode}`,authorizedHeaders:()=>({Authorization:"fixture"}),localAPI:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {};},upsertAccountProgress:row=>context.state.accountProgress.push(row),api:async()=>({}),contentAllowed:()=>true,normalize:item=>item
 };context.window={SEVENSeriesTracker:tracker};vm.createContext(context);vm.runInContext(source,context);return {context,stored,calls,ui:context.window.SEVENTrackerUI};
}
const show={id:12,name:"Show",poster_path:"/poster.png",genres:[{id:18}]},episode={episode_number:1,name:"Episode",air_date:"2020-01-01"},key="seven-progress-main-tv-12-1-1";
test("manual watched changes preserve real watch time and immediately sync the correct profile key",async()=>{
 const {stored,calls,ui}=setup();stored.set(key,JSON.stringify({currentTime:100,duration:1000,progress:10,watched:false}));
 await ui.saveStatus(show,1,episode,true);assert.equal(calls.length,1);assert.equal(calls[0].body.content_key,key);assert.equal(calls[0].body.progress_seconds,100);assert.equal(calls[0].body.duration_seconds,1000);assert.equal(calls[0].body.is_watched,true);
 await ui.saveStatus(show,1,episode,false);assert.equal(calls[1].body.is_watched,false);assert.equal(JSON.parse(stored.get(key)).watched,false);
});
test("failed saves roll back local state and allow retry",async()=>{
 const {context,stored,ui}=setup(),before=JSON.stringify({currentTime:12,duration:200,progress:6,watched:false});stored.set(key,before);
 context.localAPI=async()=>{throw Error("Offline");};await assert.rejects(ui.saveStatus(show,1,episode,true),/Offline/);assert.equal(stored.get(key),before);
 context.localAPI=async()=>({});await ui.saveStatus(show,1,episode,true);assert.equal(JSON.parse(stored.get(key)).watched,true);
});
test("rapid different episode changes are separate requests; the same pending change is not duplicated",async()=>{
 const {context,calls,ui}=setup();let resolve;context.localAPI=(url,options)=>{calls.push(JSON.parse(options.body));return new Promise(done=>resolve=done);};
 const first=ui.saveStatus(show,1,episode,true);await ui.saveStatus(show,1,episode,true);assert.equal(calls.length,1);resolve({});await first;
 context.localAPI=async(url,options)=>calls.push(JSON.parse(options.body));await ui.saveStatus(show,1,{...episode,episode_number:2},true);assert.equal(calls.length,2);
});
test("a completion arriving after a profile switch cannot update the new profile's account progress",async()=>{
 const {context,ui}=setup();context.localAPI=async()=>{context.active="other";return {};};await ui.saveStatus(show,1,episode,true);assert.equal(context.state.accountProgress.length,0);
});
test("guests and future episodes cannot mutate watched state; corrupt local records recover safely",async()=>{
 const {context,stored,ui}=setup();context.state.session=null;await assert.rejects(ui.saveStatus(show,1,episode,true),/Sign in/);
 context.state.session={access_token:"fixture"};await assert.rejects(ui.saveStatus(show,1,{...episode,air_date:"2099-01-01"},true),/release date/);
 stored.set(key,"not-json");await ui.saveStatus(show,1,episode,true);assert.equal(JSON.parse(stored.get(key)).watched,true);
});
test("following merges Watchlist and Favourites without including another profile's saved shows",()=>{
 const {context,ui}=setup();context.state.watchlist=[{type:"tv",id:1},{type:"movie",id:9}];context.listItems=()=>[{type:"tv",id:1},{type:"tv",id:2}];assert.deepEqual(Array.from(ui.follows(),item=>item.id),[1,2]);
 context.state.watchlistProfileId="other";context.listItems=()=>[];assert.equal(ui.follows().length,0);
});
test("existing guest series-page controls can save locally without accessing account progress",async()=>{
 const {context,stored,calls,ui}=setup();context.state.session=null;context.owner=null;
 await ui.saveStatus(show,1,episode,true,{allowGuest:true});assert.equal(JSON.parse(stored.get(key)).watched,true);assert.equal(calls.length,0);assert.equal(context.state.accountProgress.length,0);
});
