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
  watchKey:item=>`seven-progress-${context.active}-${item.type}-${item.id}-${item.season}-${item.episode}`,authorizedHeaders:()=>({Authorization:"fixture"}),localAPI:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {};},upsertAccountProgress:row=>context.state.accountProgress.push(row),api:async()=>({}),contentAllowed:()=>true,normalize:item=>item,
  titleOf:item=>item.name||item.title||"Show",accountProgressRecord:row=>({type:row.content_type,id:row.tmdb_id,season:row.season,episode:row.episode,currentTime:row.progress_seconds,duration:row.duration_seconds,watched:row.is_watched,progress:row.is_watched?100:0,lastWatchedAt:row.last_watched_at}),forgetAccountProgress:key=>context.state.accountProgress=context.state.accountProgress.filter(row=>row.content_key!==key)
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
function batchSetup(){
 const fixture=setup(),remote=new Map();fixture.context.localAPI=async(url,options)=>{
  if(!options)return [...remote.values()];const body=JSON.parse(options.body);fixture.calls.push({url,body});
  if(body.action==='read')return body.keys.map(key=>remote.get(key)).filter(Boolean);
  if(body.action==='undo')return {results:body.entries.map(item=>{const current=remote.get(item.key);if(current?.last_watched_at!==item.expected)return {key:item.key,status:'changed'};if(item.previous)remote.set(item.key,item.previous);else remote.delete(item.key);return {key:item.key,status:'restored'};})};
  for(const row of body.records||[])remote.set(row.content_key,row);return body.records||{};
 };return {...fixture,remote};
}
const batchShow={...show,type:'tv'};
test('batch changes deduplicate episodes, preserve watch time and undo exact previous/absent records',async()=>{
 const {ui,remote,stored}=batchSetup(),previous={content_key:key,content_type:'tv',tmdb_id:12,season:1,episode:1,title:'Episode',poster_path:null,progress_seconds:12,duration_seconds:200,is_watched:false,last_watched_at:'2020-01-01T00:00:00.000Z'};remote.set(key,previous);
 const changes=[1,2,2].map(number=>({show:batchShow,season:1,episode:{...episode,episode_number:number},value:true}));assert.equal((await ui.saveBatch(changes)).count,2);assert.equal(remote.get(key).progress_seconds,12);assert.equal(remote.get('seven-progress-main-tv-12-1-2').progress_seconds,0);assert.equal(ui.hasUndo(),true);
 assert.equal((await ui.undoBatch()).count,2);assert.deepEqual(remote.get(key),previous);assert.equal(remote.has('seven-progress-main-tv-12-1-2'),false);assert.equal(stored.has('seven-progress-main-tv-12-1-2'),false);assert.equal(ui.hasUndo(),false);
});
test('failed atomic save does not create local watched marks or an undo entry',async()=>{
 const {context,ui,stored}=batchSetup();context.localAPI=async(url,options)=>{if(JSON.parse(options.body).action==='read')return [];throw Error('Offline');};await assert.rejects(ui.saveBatch([{show:batchShow,season:1,episode,value:true}]),/Offline/);assert.equal(stored.has(key),false);assert.equal(ui.hasUndo(),false);
});
test('undo keeps newer progress and is profile scoped',async()=>{
 const {context,ui,remote}=batchSetup();await ui.saveBatch([{show:batchShow,season:1,episode,value:true}]);context.active='other';assert.equal(ui.hasUndo(),false);assert.equal((await ui.undoBatch()).count,0);context.active='main';remote.get(key).last_watched_at='2099-01-01T00:00:00.000Z';remote.get(key).progress_seconds=100;const result=await ui.undoBatch();assert.equal(result.changed,1);assert.equal(remote.get(key).progress_seconds,100);
});
test('bulk rejects guests, future/unknown dates, and profile switches before a write',async()=>{
 const {context,ui,calls}=batchSetup();context.state.session=null;await assert.rejects(ui.saveBatch([{show:batchShow,season:1,episode,value:true}]),/Sign in/);context.state.session={};for(const date of [null,'2099-01-01'])await assert.rejects(ui.saveBatch([{show:batchShow,season:1,episode:{...episode,air_date:date},value:true}]),/released/);
 context.localAPI=async()=>{context.active='other';return [];};await assert.rejects(ui.saveBatch([{show:batchShow,season:1,episode,value:true}]),/Profile changed/);assert.equal(calls.length,0);
});
test('partial undo retains only unfinished records and can finish on retry in bounded batches',async()=>{
 const {context,ui,remote,calls}=batchSetup();await ui.saveBatch(Array.from({length:25},(_,index)=>({show:batchShow,season:1,episode:{...episode,episode_number:index+1},value:true})));const original=context.localAPI;let fail=true;
 context.localAPI=async(url,options)=>{if(options){const body=JSON.parse(options.body);if(body.action==='undo'&&fail){fail=false;const rejected=body.entries[0],result=await original(url,{...options,body:JSON.stringify({...body,entries:body.entries.slice(1)})});result.results.push({key:rejected.key,status:'failed'});return result;}}return original(url,options);};
 await assert.rejects(ui.undoBatch(),/couldn’t be undone/);assert.equal(ui.hasUndo(),true);assert.equal(remote.size,6);assert.equal((await ui.undoBatch()).count,6);assert.equal(remote.size,0);assert.equal(ui.hasUndo(),false);assert.ok(calls.filter(call=>call.body.action==='undo').every(call=>call.body.entries.length<=20));
});
test('long-show catch-up can continue beyond 1,000 total episodes by saving only new changes',async()=>{
 const {ui,remote,calls}=batchSetup();for(let episode=1;episode<=1000;episode++)remote.set(`seven-progress-main-tv-12-1-${episode}`,{content_key:`seven-progress-main-tv-12-1-${episode}`,content_type:'tv',tmdb_id:12,season:1,episode,title:'Episode',poster_path:null,progress_seconds:0,duration_seconds:0,is_watched:true,last_watched_at:'2020-01-01T00:00:00.000Z'});
 const changes=Array.from({length:1010},(_,index)=>({show:batchShow,season:1,episode:{...episode,episode_number:index+1},value:true}));assert.equal((await ui.saveBatch(changes)).count,10);assert.ok(calls.filter(call=>call.body.action==='read').every(call=>call.body.keys.length<=1000));assert.equal(remote.size,1010);
});
function withQuickUndo(){const f=batchSetup(),original=f.context.localAPI;f.context.localAPI=async(url,options)=>{if(url==='/api/account/progress'&&options){const body=JSON.parse(options.body);f.remote.set(body.content_key,body);return body;}return original(url,options);};f.undo=require('../undo-actions').create({scope:()=>f.context.owner+':'+f.context.active,schedule:()=>0,cancel(){}});f.context.window.SEVENUndo=f.undo;return f;}
test('quick manual Undo retains legacy progress and accepts equivalent database timestamp formatting',async()=>{
 const {ui,undo,stored,remote}=withQuickUndo(),before=JSON.stringify({currentTime:100,duration:1000,progress:10,watched:false});stored.set(key,before);await ui.saveStatus(show,1,episode,true);const current=JSON.parse(stored.get(key));current.lastWatchedAt=current.lastWatchedAt.replace('Z','+00:00');current.progress=10;stored.set(key,JSON.stringify(current));assert.equal((await undo.run()).undone,true);assert.equal(stored.get(key),before);assert.equal(remote.get(key).progress_seconds,100);assert.equal(remote.get(key).is_watched,false);
});
test('quick manual Undo cannot overwrite newer local playback',async()=>{
 const {ui,undo,stored,remote}=withQuickUndo();await ui.saveStatus(show,1,episode,true);const current=JSON.parse(stored.get(key));current.currentTime=300;current.lastWatchedAt='2099-01-01T00:00:00.000Z';stored.set(key,JSON.stringify(current));assert.equal((await undo.run()).changed,true);assert.equal(JSON.parse(stored.get(key)).currentTime,300);assert.equal(remote.get(key).is_watched,true);
});
test('quick bulk Undo remains retryable after a partially successful response',async()=>{
 const {context,ui,undo,remote}=withQuickUndo();await ui.saveBatch([1,2].map(n=>({show:batchShow,season:1,episode:{...episode,episode_number:n},value:true})));const original=context.localAPI;let fail=true;context.localAPI=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='undo'&&fail){fail=false;const result=await original(url,{...options,body:JSON.stringify({...body,entries:body.entries.slice(1)})});result.results.push({key:body.entries[0].key,status:'failed'});return result;}return original(url,options);};assert.equal((await undo.run()).error,true);assert.equal(remote.size,1);assert.ok(undo.current());assert.equal((await undo.run()).undone,true);assert.equal(remote.size,0);
});
test('bulk Undo skips unsynced newer local playback before sending a restore',async()=>{
 const {ui,stored,remote,calls}=withQuickUndo();await ui.saveBatch([{show:batchShow,season:1,episode,value:true}]);const current=JSON.parse(stored.get(key));current.currentTime=400;current.lastWatchedAt='2099-01-01T00:00:00.000Z';stored.set(key,JSON.stringify(current));const result=await ui.undoBatch();assert.equal(result.changed,1);assert.equal(JSON.parse(stored.get(key)).currentTime,400);assert.equal(remote.size,1);assert.equal(calls.filter(call=>call.body.action==='undo').length,0);
});
