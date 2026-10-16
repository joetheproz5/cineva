// Optional browser regression suite. All account writes use fixtures, including SEVEN_LIVE=1.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT_PATH || 'playwright');
const root=path.resolve(__dirname,'..'),shots=process.env.TEMP || require('node:os').tmpdir();let films,requests=[],failRelated=false,failCollection=false,heldRelated=null;
const fixture=(id,extra={})=>({...films[0],id,title:'Related film '+id,belongs_to_collection:null,...extra});
const series={id:1396,name:'Breaking Bad',type:'Scripted',first_air_date:'2008-01-20',poster_path:'/ztkUQFLlC19CCMYHW9o1zWhJrn7.jpg',backdrop_path:films?.[0]?.backdrop_path,number_of_seasons:1,number_of_episodes:1,seasons:[{season_number:1}],credits:{cast:[],crew:[]},videos:{results:[]},genres:[{id:18,name:'Drama'}]};
const collection=()=>({id:404609,name:'John Wick Collection',overview:'Every chapter. In release order.',backdrop_path:films[0].backdrop_path,parts:[films[2],films[0],films[1],films[3],fixture(99999,{title:'A future chapter',release_date:'2099-01-01'}),fixture(99998,{title:'An unannounced chapter',release_date:''})]});
const api=async(req,url)=>{
 requests.push(url.pathname);if(heldRelated&&/\/(recommendations|similar)$/.test(url.pathname))await heldRelated;
 if(url.pathname==='/api/config')return {configured:true};
 if(url.pathname==='/api/account/watchlist')return req.method==='GET'?[]:[];
 if(url.pathname.includes('/collection/')){if(failCollection)throw Error('Collection fixture offline');return collection();}
 if(/\/(recommendations|similar)$/.test(url.pathname)){
  if(failRelated)throw Error('Related fixture offline');const page=Number(url.searchParams.get('page')||1),tv=url.pathname.includes('/tv/'),similar=url.pathname.endsWith('/similar');
  const items=Array.from({length:20},(_,i)=>fixture((page-1)*20+i+100,{...(tv?{type:'tv',media_type:'tv',name:'Related show '+i,title:undefined,first_air_date:'2020-01-01'}:{type:'movie'}),poster_path:films[i%films.length].poster_path,genre_ids:[18]}));
  return {results:[films[1],fixture(500,{release_date:'2099-01-01'}),...items],total_pages:2,page};
 }
 if(/\/tv\/1396\/season\//.test(url.pathname))return {episodes:[{id:1,episode_number:1,name:'Pilot',runtime:58,air_date:'2008-01-20',still_path:films[0].backdrop_path}]};
 if(url.pathname.endsWith('/tv/1396'))return {...series,backdrop_path:films[0].backdrop_path};
 const id=Number(url.pathname.split('/').at(-1));if(url.pathname.includes('/movie/')&&id)return {...(films.find(item=>item.id===id)||fixture(id)),credits:{cast:[],crew:[]},videos:{results:[]}};
 if(url.pathname.endsWith('/videos'))return {results:[]};
 if(url.pathname.startsWith('/api/tmdb/'))return {results:films,total_pages:1};return [];
};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');try{res.end(JSON.stringify(await api(req,url)));}catch(error){res.writeHead(503);res.end(JSON.stringify({error:error.message}));}return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 films=await Promise.all([245891,324552,458156,603692].map(async id=>{const response=await fetch('https://seven-9fm.pages.dev/api/tmdb/movie/'+id);assert.ok(response.ok);return {...await response.json(),type:'movie'};}));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=process.env.SEVEN_LIVE?'https://seven-9fm.pages.dev':'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [1440,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:width<650?844:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await context.addInitScript(()=>localStorage.setItem('seven.account.settings',JSON.stringify({preferences:{introEnabled:false}})));
  if(process.env.SEVEN_LIVE)await page.route('**/api/**',async route=>{try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await api({method:route.request().method()},new URL(route.request().url())))});}catch(error){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:error.message})});}});
  await page.goto(origin+'/?title=movie:245891');await page.waitForSelector('.franchise-preview');await page.waitForFunction(()=>!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);
  await page.evaluate(()=>document.querySelector('.seven-intro')?.remove());
  assert.equal(await page.locator('.discovery-grid .discovery-card').count(),6);
  assert.equal(await page.locator('.card-play').count(),0);
  await page.locator('[data-more-related]').click();await page.waitForFunction(()=>!state.titleDiscovery.loading);assert.equal(await page.locator('.discovery-grid .discovery-card').count(),12);
  // Stage a test account in memory only; every account request is handled by the fixture server.
  await page.evaluate(()=>{
   state.user={id:'qa',email:'qa@example.test'};state.session={access_token:'fixture'};
   state.account={activeProfileId:'main',profiles:[{id:'main',name:'QA'},{id:'other',name:'Other'}],preferences:{introEnabled:false}};
   localStorage.setItem(watchKey({type:'movie',id:245891}),JSON.stringify({type:'movie',id:245891,watched:true,progress:100}));
   localStorage.setItem(watchKey({type:'movie',id:324552}),JSON.stringify({type:'movie',id:324552,currentTime:600,duration:7200,progress:8.33}));
   state.watchlistOwnerId='qa';state.watchlistProfileId='main';state.watchlist=[];render();
  });
  await page.waitForFunction(()=>!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);
  await page.locator('[data-open-franchise]').click();await page.waitForSelector('.franchise-page');
  assert.match(await page.locator('.franchise-progress-summary').innerText(),/1\/4/);
  assert.match(await page.locator('.franchise-next').innerText(),/Chapter 2/);
  assert.equal(await page.locator('.franchise-grid .discovery-card').count(),6);
  const ids=await page.locator('.franchise-grid .discovery-card-open').evaluateAll(elements=>elements.map(el=>el.dataset.open));assert.deepEqual(ids.slice(0,4),films.map(item=>'movie:'+item.id));
  assert.equal(await page.locator('.franchise-grid .discovery-watched').count(),1);
  await page.locator('[data-franchise-filter="watched"]').click();assert.equal(await page.locator('.franchise-grid .discovery-card').count(),1);
  await page.locator('[data-franchise-filter="unwatched"]').click();assert.equal(await page.locator('.franchise-grid .discovery-card').count(),5);
  await page.locator('[data-franchise-filter="all"]').click();await page.locator('[data-franchise-order]').selectOption('newest');
  assert.equal(await page.locator('.franchise-grid .discovery-order').nth(4).innerText(),'01');
  await page.locator('[data-franchise-order]').selectOption('release');
  const bookmark=page.locator('.franchise-grid .card-watchlist').nth(1);await bookmark.click();await page.waitForFunction(()=>state.watchlist.length===1);assert.equal(await bookmark.getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(shots,'seven-franchise-'+width+'.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow '+width);
  await page.locator('.franchise-grid [data-open="movie:324552"]').click();await page.waitForFunction(()=>state.route==='movie'&&state.movie.id===324552);await page.goBack();await page.waitForSelector('.franchise-page');
  assert.equal(await page.locator('.franchise-grid .card-watchlist').nth(1).getAttribute('aria-pressed'),'true');
  await page.locator('[data-franchise-back]').click();await page.waitForFunction(()=>state.route==='movie'&&state.movie.id===245891);await page.waitForFunction(()=>!state.titleDiscovery.loading);
  await page.locator('[data-related-titles]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'seven-related-'+width+'.png'),fullPage:false});
  // Profile changes cannot inherit collection counts or saved-state.
  await page.evaluate(()=>{state.account.activeProfileId='other';state.watchlistProfileId='other';state.watchlist=[];render();});await page.waitForFunction(()=>!state.titleDiscovery.loading);
  await page.locator('[data-open-franchise]').click();assert.match(await page.locator('.franchise-progress-summary').innerText(),/0\/4/);
  assert.equal(await page.locator('.franchise-grid .card-watchlist.saved').count(),0);
  // Family filtering must explain the missing collection, never bypass content or parent controls.
  await page.evaluate(()=>{state.route='movie';state.movie=state.franchise.source;currentProfile().preferences={familySafe:true};render();});
  await page.waitForFunction(()=>!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);
  assert.equal(await page.locator('.franchise-unavailable').count(),1);assert.equal(await page.locator('.franchise-unavailable img').count(),0);
  assert.equal(await page.locator('[data-open-franchise]').count(),0);
  await page.evaluate(()=>{state.account.parentAccessEnabled=true;});await page.locator('[data-discovery-settings]').click();
  assert.equal(await page.locator('.parent-unlock').count(),1);assert.equal(await page.evaluate(()=>state.route),'movie');
  await page.locator('.parent-unlock [data-close]').click();await page.evaluate(()=>{state.account.parentAccessEnabled=false;});
  await page.locator('[data-discovery-settings]').click();assert.equal(await page.evaluate(()=>state.route),'profile-settings');
  await page.goBack();await page.waitForSelector('.franchise-unavailable');assert.equal(await page.evaluate(()=>currentPreferences().familySafe),true);
  await page.evaluate(()=>{currentProfile().preferences.familySafe=false;render();});assert.equal(await page.locator('[data-open-franchise]').count(),1);
  // TV details get their own TV-only related results and no movie collection banner.
  await page.evaluate(()=>openItem('tv',1396));await page.waitForFunction(()=>state.route==='series'&&!state.titleDiscovery.loading);
  assert.equal(await page.locator('.franchise-preview').count(),0);assert.equal(await page.locator('.related-titles .discovery-card').count(),6);
  assert.ok((await page.locator('.related-titles [data-open]').evaluateAll(elements=>elements.map(el=>el.dataset.open))).every(id=>id.startsWith('tv:')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No TV overflow '+width);
  if(width===390){
   await page.evaluate(()=>openItem('movie',245891));await page.waitForFunction(()=>!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);
   await page.locator('[data-open-franchise]').click();
   await page.evaluate(()=>{state.franchise.collection={...state.franchise.collection,parts:Array.from({length:53},(_,i)=>({...state.movie,id:800+i,title:'Chapter '+i,release_date:'2020-01-01'}))};render();});
   assert.equal(await page.locator('.franchise-grid .discovery-card').count(),20);
   await page.locator('[data-more-franchise]').click();assert.equal(await page.locator('.franchise-grid .discovery-card').count(),40);
   assert.equal(await page.locator('.franchise-grid .card-watchlist.saved').count(),0);
   await page.locator('.franchise-grid .card-watchlist').nth(20).click();await page.waitForFunction(()=>state.watchlist.some(item=>item.id===820));
   await page.locator('[data-more-franchise]').click();assert.equal(await page.locator('.franchise-grid .discovery-card').count(),53);assert.equal(await page.locator('[data-more-franchise]').count(),0);
   await page.locator('[data-franchise-filter="watched"]').click();assert.equal(await page.locator('.discovery-empty').count(),1);
   // Fully watched collections have no false next-film suggestion.
   await page.evaluate(()=>{for(const item of state.franchise.collection.parts)localStorage.setItem(watchKey(item),JSON.stringify({watched:true}));render();});
   assert.equal(await page.locator('.franchise-next').count(),0);assert.equal(await page.locator('.franchise-complete').count(),1);
   await page.evaluate(()=>{state.franchise.collection.name='<img src=x onerror="window.badMetadata=true">';render();});
   assert.equal(await page.evaluate(()=>!!window.badMetadata),false);assert.match(await page.locator('h1').innerText(),/<img/);
   // Localised labels and RTL layout do not change title/profile identity.
   await page.evaluate(()=>{currentProfile().preferences={language:'French'};applyLocale();return openItem('movie',245891);});await page.waitForFunction(()=>!state.titleDiscovery.loading);
   assert.equal(await page.locator('.discovery-heading h2').innerText(),'Titres similaires');
   await page.evaluate(()=>{currentProfile().preferences={language:'Arabic'};applyLocale();return openItem('movie',245891);});await page.waitForFunction(()=>!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);
   await page.locator('[data-open-franchise]').click();assert.equal(await page.locator('[data-franchise-filter="all"]').innerText(),'الكل');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   await page.evaluate(()=>{currentProfile().restrictedTitles=[{id:324552,type:'movie'}];currentProfile().hiddenTitles=[{id:458156,type:'movie'}];render();});
   assert.equal(await page.locator('.franchise-grid [data-open="movie:324552"]').count(),0);assert.equal(await page.locator('.franchise-grid [data-open="movie:458156"]').count(),0);
   console.log('PASS pagination, completed, unsafe metadata, languages and restrictions');
  }
  assert.deepEqual(errors,[]);console.log('PASS desktop/mobile flow',width);await context.close();
 }
 // Recovery and stale response coverage use isolated contexts, avoiding the metadata cache.
 for(const scenario of ['failure','stale']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.SEVEN_LIVE)await page.route('**/api/**',async route=>{try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await api({method:route.request().method()},new URL(route.request().url())))});}catch(error){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:error.message})});}});
  if(scenario==='failure'){failCollection=true;failRelated=true;await page.goto(origin+'/?title=movie:245891');await page.waitForFunction(()=>state.titleDiscovery?.started&&!state.titleDiscovery.loading&&!state.titleDiscovery.collectionLoading);await page.evaluate(()=>document.querySelector('.seven-intro')?.remove());assert.equal(await page.locator('[data-retry-collection]').count(),1);assert.equal(await page.locator('.related-titles .discovery-card').count(),0);failCollection=false;failRelated=false;await page.locator('[data-retry-collection]').click();await page.waitForSelector('.franchise-preview');await page.locator('[data-more-related]').click();await page.waitForSelector('.related-titles .discovery-card');}
  else{let resume;heldRelated=new Promise(done=>{resume=done;});await page.goto(origin+'/?title=movie:245891',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>state.titleDiscovery?.loading);await page.evaluate(()=>{state.route='home';render();});heldRelated=null;resume();await page.waitForFunction(()=>!state.titleDiscovery.loading);assert.equal(await page.locator('[data-title-discovery]').count(),0);}
  assert.deepEqual(errors,[]);console.log('PASS',scenario);await context.close();
 }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
