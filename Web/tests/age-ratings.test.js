const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),model=require('../age-ratings');
const movie=(...codes)=>({results:[{iso_3166_1:'US',release_dates:codes.map(certification=>({certification}))}]}),tv=(...codes)=>({results:codes.map(rating=>({iso_3166_1:'US',rating}))});
test('US movie classifications enforce Kids, 13+, 16+ and unrestricted profiles',()=>{
 for(const [code,kids,teen]of [['G',true,true],['PG',true,true],['PG-13',false,true],['R',false,false],['NC-17',false,false]]){
  const record=model.classification('movie',movie(code));assert.equal(record.code,code);assert.equal(model.permits(record,'Kids'),kids);assert.equal(model.permits(record,'13+'),teen);assert.equal(model.permits(record,'16+'),teen);assert.equal(model.permits(record,'18+'),true);
 }
});
test('TV-14 is not allowed by a 13+ cap, and TV-MA never passes a child/teen profile',()=>{
 for(const code of ['TV-Y','TV-Y7','TV-Y7-FV','TV-G','TV-PG'])assert.equal(model.permits(model.classification('tv',tv(code)),'Kids'),true,code);
 const teen=model.classification('tv',tv('TV-14'));assert.equal(model.permits(teen,'13+'),false);assert.equal(model.permits(teen,'16+'),true);
 const mature=model.classification('tv',tv('TV-MA'));for(const limit of ['Kids','13+','16+'])assert.equal(model.permits(mature,limit),false);
});
test('missing, foreign-only, malformed, unrated and unrecognized ratings fail closed',()=>{
 for(const payload of [null,{}, {results:[]},movie(''),movie('NR'),movie('PG','UNRATED'),{results:[{iso_3166_1:'GB',release_dates:[{certification:'U'}]}]}]){
  const record=model.classification('movie',payload);assert.equal(record.status,'unrated');assert.equal(model.permits(record,'Kids'),false);assert.equal(model.permits(record,'18+'),true);
 }
 assert.equal(model.permits(null,'Kids'),false);assert.equal(model.permits(model.classification('movie',movie('G')),'Kids',true),false);
 assert.equal(model.permits(model.classification('movie',movie('G')),'invented'),false);
});
test('the strictest US entry wins; empty release entries do not override a real rating',()=>{
 assert.equal(model.classification('movie',movie('PG','','R')).code,'R');assert.equal(model.classification('tv',tv('TV-PG','TV-MA')).code,'TV-MA');
 assert.equal(model.classification('movie',movie(' pg-13 ','')).code,'PG-13');
});
test('lookup keys never confuse TV taxonomy, people or movie/TV IDs',()=>{
 assert.equal(model.keyOf({id:1,type:'Scripted',name:'Show'}),'tv:1');assert.equal(model.keyOf({id:1,type:'movie',title:'Film'}),'movie:1');
 for(const item of [{id:-1,type:'movie'},{id:'bad',type:'tv'},{id:1,media_type:'person'},{id:Infinity,type:'movie'}])assert.equal(model.keyOf(item),'');
 const items=model.collect({results:[{id:1,media_type:'movie',title:'Film'},{id:1,media_type:'tv',name:'Show'},{id:2,media_type:'person',name:'Person'}]},'search/multi');assert.deepEqual(items.map(model.keyOf),['movie:1','tv:1']);
 assert.equal(model.collect({parts:[{id:3,title:'Film'}]},'collection/1')[0].type,'movie');
});
test('classifications are cached by public title identity, not private profile fields',async()=>{
 let calls=0;const store=model.createStore(async(type)=>{calls++;return type==='movie'?movie('PG'):tv('TV-MA');});
 const film={id:1,type:'movie'},show={id:1,type:'tv'};await Promise.all([store.ensure(film),store.ensure(film),store.ensure(show)]);assert.equal(calls,2);
 assert.equal(store.allowed(film,'Kids'),true);assert.equal(store.allowed(show,'Kids'),false);assert.equal(store.allowed(show,'18+'),true);assert.equal(store.label(film),'PG (US)');
 assert.equal(store.allowed({id:2,type:'movie',certification:'G',genre_ids:[16]},'Kids'),false,'Unverified card fields cannot approve a title');
});
test('TTL expiry, transient failures and explicit retries never approve an unknown title',async()=>{
 let time=0,fail=true,calls=0;const store=model.createStore(async()=>{calls++;if(fail)throw Error('Offline');return movie('G');},{now:()=>time,ttl:100,errorTtl:10});const item={id:1,type:'movie'};
 assert.equal((await store.ensure(item)).status,'error');assert.equal(store.allowed(item,'Kids'),false);await store.ensure(item);assert.equal(calls,1);
 fail=false;await store.ensure(item,{force:true});assert.equal(store.allowed(item,'Kids'),true);time=101;assert.equal(store.allowed(item,'Kids'),false);await store.ensure(item);assert.equal(calls,3);
});
test('bounded lookup concurrency coalesces requests and completes a batch before exposing titles',async()=>{
 let active=0,peak=0,idle=0;const store=model.createStore(async()=>{active++;peak=Math.max(peak,active);await new Promise(done=>setTimeout(done,2));active--;return movie('PG');},{concurrency:3,onIdle:()=>idle++});
 const payload={results:Array.from({length:18},(_,i)=>({id:i+1,title:'Film'}))};await store.prepare(payload,'movie/popular',true);assert.equal(peak,3);assert.equal(store.pending(),0);assert.equal(idle,1);assert.ok(payload.results.every(item=>store.allowed(item,'Kids')));
});
test('detail responses seed classifications, while normal catalog browsing incurs no lookup fanout',async()=>{
 let calls=0;const store=model.createStore(async()=>{calls++;return movie('PG');});
 await store.prepare({results:[{id:1,title:'Film'}]},'movie/popular',false);assert.equal(calls,0);
 const item={id:2,title:'Film',release_dates:movie('R')};await store.prepare(item,'movie/2',true);assert.equal(calls,0);assert.equal(store.label(item),'R (US)');assert.equal(store.allowed(item,'Kids'),false);
 const show={id:3,name:'Show',type:'Scripted',content_ratings:tv('TV-Y7')};await store.prepare(show,'tv/3',true);assert.equal(store.allowed(show,'Kids'),true);
});
test('public rating cache is bounded and retries evicted records',async()=>{
 let calls=0;const store=model.createStore(async()=>{calls++;return movie('G');},{limit:2});for(const id of [1,2,3,1])await store.ensure({id,type:'movie'});assert.equal(calls,4);
});
test('a classification-service outage does not leave hundreds of queued lookups waiting on timeouts',async()=>{
 let calls=0,fail=true;const store=model.createStore(async()=>{calls++;if(fail)throw Error('Service down');return movie('PG');},{concurrency:3});
 const payload={results:Array.from({length:100},(_,i)=>({id:i+1,title:'Film'}))};await store.prepare(payload,'movie/popular',true);
 assert.ok(calls<15);assert.equal(store.pending(),0);assert.ok(payload.results.every(item=>!store.allowed(item,'Kids')));
 fail=false;await store.ensure(payload.results[0],{force:true});assert.equal(store.allowed(payload.results[0],'Kids'),true);
});
test('both proxies allow numeric rating routes without exposing arbitrary TMDB paths',async()=>{
 const {onRequest}=await import(pathToFileURL(path.resolve(__dirname,'../../functions/api/[[path]].js')).href),original=global.fetch;
 const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8'),allowed=Function(`return ${server.match(/const tmdbAllowed = (\/.*\/);/)[1]}`)();let calls=0;
 global.fetch=async()=>{calls++;return Response.json({results:[]});};
 try{for(const endpoint of ['movie/1/release_dates','tv/2/content_ratings','movie/no/release_dates','tv/2/ratings','tv/2/release_dates','movie/1/content_ratings']){
  const valid=['movie/1/release_dates','tv/2/content_ratings'].includes(endpoint),response=await onRequest({request:new Request('https://seven.example/api/tmdb/'+endpoint),params:{path:'tmdb/'+endpoint},env:{TMDB_BEARER_TOKEN:'fixture'}});assert.equal(response.status,valid?200:400,endpoint);assert.equal(allowed.test(endpoint),valid,endpoint);
 }assert.equal(calls,2);}finally{global.fetch=original;}
});
test('details, replay and party playback are gated before any iframe is created',()=>{
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
 for(const [name,field]of [['renderMovie','movie'],['renderSeries','series'],['renderPlayer','player']])assert.match(app,new RegExp(`function ${name}\\(\\) \\{\\s*if \\(!contentAllowed\\(state\\.${field}, \\{directSearch:true\\}\\)\\) return renderRestrictedTitle`));
 assert.match(app,/append_to_response[^\n]*release_dates[^\n]*content_ratings/);assert.match(app,/SEVENAge.prepare\(payload, path, currentProfile\(\)\?\.kids === true\)/);
 assert.doesNotMatch(app,/vote_average\.toFixed\(1\)\}` : "TV-14"/);
 assert.match(app,/allItems = state.watchlist.filter\(contentAllowed\)/);assert.match(app,/allItems = listItems\(\).filter\(contentAllowed\)/);
});
test('new classification assets ship before app code in the refreshed PWA shell',()=>{
 const base=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(base,'index.html'),'utf8'),sw=fs.readFileSync(path.join(base,'service-worker.js'),'utf8');
 for(const name of ['age-ratings.js?v=1','age-ratings.css?v=1','series-tracker-ui.js?v=3']){assert.ok(index.includes(name));assert.ok(sw.includes(name));}
 assert.ok(index.indexOf('age-ratings.js?v=1')<index.indexOf('app.js?v=376'));assert.match(sw,/seven-v376/);
 assert.match(sw,/release_dates\|content_ratings[^\n]*event.respondWith\(fetch\(event.request\)\)/);
});
