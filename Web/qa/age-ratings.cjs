// Fresh isolated browsers. Every API, image, player and account request is a fixture.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT_PATH||'playwright'),root=path.resolve(__dirname,'..');
const film=(id,extra={})=>({id,title:'Film '+id,type:'movie',media_type:'movie',poster_path:'/age.svg',backdrop_path:'/age.svg',release_date:'2020-01-01',vote_average:8,genre_ids:[16],...extra});
const show=(id,extra={})=>({id,name:'Show '+id,type:'Scripted',media_type:'tv',poster_path:'/age.svg',backdrop_path:'/age.svg',first_air_date:'2020-01-01',vote_average:8,genre_ids:[18],...extra});
const films=[film(101,{title:'Safe PG film',genre_ids:[80]}),film(102,{title:'Adult animation'}),film(103,{title:'Unrated family film',genre_ids:[10751]}),film(104,{title:'Teen PG13 film'})],shows=[show(201,{name:'Safe TVY7 show'}),show(202,{name:'Mature TVMA drama'}),show(203,{name:'Teen TV14 drama'})];
const movieRatings={101:'PG',102:'R',104:'PG-13',105:'G',107:'PG'},tvRatings={201:'TV-Y7',202:'TV-MA',203:'TV-14'};
const rated=(type,id)=>({results:type==='movie'?[{iso_3166_1:'US',release_dates:[{certification:movieRatings[id]||''}]}]:[{iso_3166_1:'US',rating:tvRatings[id]||''}]});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#273440"/></svg>';
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=process.env.SEVEN_LIVE?'https://seven-9fm.pages.dev':'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let hold=null,ratingHold=null,fail105=true,requests=[];
  page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('seven.account.settings',JSON.stringify({preferences:{introEnabled:false,autoplayPreviews:false}})));
  await page.route('https://image.tmdb.org/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:svg}));
  await page.route(/https:\/\/(?:cinesrc|vidfast|multiembed|vidsrc|www\.2embed)\./,r=>r.fulfill({status:200,contentType:'text/html',body:'<html>Fixture player</html>'}));
  await page.route('**/api/**',async r=>{
   const u=new URL(r.request().url()),endpoint=u.pathname.replace('/api/tmdb/','');requests.push(endpoint);let value={results:[],total_pages:1};
   const rating=/^(movie|tv)\/(\d+)\/(release_dates|content_ratings)$/.exec(endpoint);
   if(rating){if(Number(rating[2])===107&&ratingHold)await ratingHold;if(Number(rating[2])===105&&fail105)return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture offline"}'});value=rated(rating[1],Number(rating[2]));}
   else if(/^collection\//.test(endpoint))value={id:1,name:'Age fixture collection',parts:films,backdrop_path:'/age.svg'};
   else if(/person\/\d+/.test(endpoint))value={id:1,name:'Fixture actor',combined_credits:{cast:[...films,...shows],crew:[]}};
   else if(/^(movie|tv)\/\d+$/.test(endpoint)){
    const [type,key]=endpoint.split('/'),id=Number(key);if(id===106&&hold)await hold;
    value={...(type==='movie'?films.find(f=>f.id===id)||film(id):shows.find(s=>s.id===id)||show(id)),genres:[],credits:{cast:[],crew:[]},videos:{results:[]},seasons:[{season_number:1}],number_of_seasons:1};
    if(id!==105&&id!==106)value[type==='movie'?'release_dates':'content_ratings']=rated(type,id);
    if(id===101)value.belongs_to_collection={id:1};
   }else if(/\/season\//.test(endpoint))value={episodes:[{id:1,name:'Episode',episode_number:1,air_date:'2020-01-01'}]};
   else if(endpoint.endsWith('/videos'))value={results:[]};
   else if(endpoint.endsWith('/recommendations')||endpoint.endsWith('/similar'))value={results:[...films,...shows],total_pages:1};
   else if(u.pathname.startsWith('/api/tmdb/'))value={results:endpoint.startsWith('tv/')||endpoint==='discover/tv'?shows:endpoint.startsWith('movie/')||endpoint==='discover/movie'?films:[...films,...shows],total_pages:1};
   else if(u.pathname==='/api/config')value={configured:true};
   else if(u.pathname==='/api/account/settings'||u.pathname==='/api/auth/user')value={id:'qa',email:'qa@example.test'};
   else value=[];
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  });
  await page.goto(origin);await page.waitForSelector('.spotlight-slide');await page.evaluate(()=>document.querySelector('.seven-intro')?.remove());
  await page.evaluate(async()=>{
   state.user={id:'qa',email:'qa@example.test'};state.session={access_token:'fixture'};
   state.account={activeProfileId:'kid',parentPinHash:'fixture',profiles:[{id:'kid',name:'Kids',kids:true,preferences:{maturity:'Kids',introEnabled:false,autoplayPreviews:false}},{id:'main',name:'Main',kids:false,preferences:{maturity:'Kids',introEnabled:false,autoplayPreviews:false}}],preferences:{introEnabled:false,autoplayPreviews:false}};
   state.route='home';await refreshCatalogForLanguage();render();
  });
  await page.waitForFunction(()=>!SEVENAge.pending());
  const allowed=await page.evaluate(()=>[101,102,103,104].map(id=>contentAllowed({id,type:'movie',genre_ids:[16]})));
  assert.deepEqual(allowed,[true,false,false,false]);assert.equal(await page.locator('[data-open="movie:102"]').count(),0);assert.equal(await page.locator('[data-open="tv:202"]').count(),0);assert.ok(await page.locator('[data-open="movie:101"]').count());
  await page.evaluate(()=>search('Film'));await page.waitForFunction(()=>!state.searchView.loading);assert.equal(await page.locator('[data-open="movie:102"]').count(),0);assert.equal(await page.locator('[data-open="tv:202"]').count(),0);assert.ok(await page.locator('[data-open="movie:101"]').count());
  await page.evaluate(()=>openCatalog('movie'));await page.waitForFunction(()=>!state.browse.loading);assert.equal(await page.locator('[data-open="movie:102"]').count(),0);assert.ok(await page.locator('[data-open="movie:101"]').count());
  await page.evaluate(()=>openForYou());await page.waitForFunction(()=>!state.forYou.loading);assert.equal(await page.locator('[data-open="movie:102"]').count(),0);assert.equal(await page.locator('[data-open="tv:202"]').count(),0);
  await page.evaluate(()=>openItem('movie',102));assert.equal(await page.locator('.age-restriction-page').count(),1);assert.equal(await page.locator('iframe.player').count(),0);assert.equal(await page.locator('.detail').count(),0);
  await page.screenshot({path:path.join(require('node:os').tmpdir(),'seven-age-blocked-'+width+'.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>openItem('tv',202));assert.equal(await page.locator('.age-restriction-page').count(),1);
  await page.evaluate(()=>openItem('movie',103));assert.match(await page.locator('.age-restriction-page').innerText(),/couldn’t verify/);
  await page.evaluate(()=>openItem('movie',101));await page.waitForSelector('.detail');assert.match(await page.locator('.media-info').innerText(),/PG \(US\)/);assert.equal(await page.locator('.franchise-preview-posters img').count(),1,'Restricted collection posters are not exposed');
  await page.locator('[data-open-franchise]').click();assert.equal(await page.locator('.franchise-grid .discovery-card').count(),1);
  await page.evaluate(()=>openPerson(1));await page.waitForSelector('.person-hero h1');assert.equal(await page.locator('[data-open="movie:102"]').count(),0);assert.equal(await page.locator('[data-open="tv:202"]').count(),0);
  await page.evaluate(()=>{state.player={type:'movie',id:102,title:'Blocked party movie'};state.route='player';render();});assert.equal(await page.locator('iframe.player').count(),0);assert.equal(await page.locator('.age-restriction-page').count(),1);
  let releaseRating;ratingHold=new Promise(done=>releaseRating=done);await page.evaluate(()=>{state.player={type:'movie',id:107,title:'Unverified sparse replay'};state.route='player';render();});assert.match(await page.locator('.age-restriction-page').innerText(),/Checking age rating/);assert.equal(await page.locator('iframe.player').count(),0);releaseRating();await page.waitForSelector('iframe.player');ratingHold=null;
  // Sparse, previously saved titles must also be checked, without deleting their records.
  await page.evaluate(()=>{state.myList=[{profileId:'kid',type:'movie',id:101,title:'Safe saved'},{profileId:'kid',type:'movie',id:102,title:'Blocked saved'},{profileId:'kid',type:'movie',id:103,title:'Unknown saved'}];state.route='my-list';render();});
  assert.equal(await page.locator('.my-list-card').count(),1);assert.equal(await page.evaluate(()=>state.myList.length),3);
  await page.evaluate(()=>{state.watchlistOwnerId='qa';state.watchlistProfileId='kid';state.watchlist=state.myList;state.watchlistLoaded=true;state.route='watchlist';render();});assert.equal(await page.locator('.watchlist-grid .watchlist-card').count(),1,JSON.stringify(await page.evaluate(()=>({view:state.watchlistView,items:state.watchlist,profile:activeProfileId(),owner:accountWatchlistUserId(),age:SEVENAge.get({id:101,type:'movie'})}))));
  await page.evaluate(()=>{for(const id of [101,102,103]){const key=watchKey({type:'movie',id});localStorage.setItem(key,JSON.stringify({type:'movie',id,title:'Saved '+id,currentTime:60,duration:7200}));}state.route='history';render();});assert.equal(await page.locator('.history-item').count(),1);
  await page.evaluate(()=>{state.route='home';state.accountProgress=[101,102,103].map(id=>({key:watchKey({type:'movie',id}),type:'movie',id,title:'Saved '+id,currentTime:60,duration:7200}));render();});assert.equal(await page.locator('.continue-item').count(),1);
  // A failed lookup remains blocked, then an explicit retry can recover.
  await page.evaluate(()=>openItem('movie',105));assert.equal(await page.locator('.age-restriction-page').count(),1);fail105=false;await page.locator('[data-retry-age]').click();await page.waitForSelector('.detail');assert.match(await page.locator('.media-info').innerText(),/G \(US\)/);
  await page.evaluate(()=>{updateCurrentPreferences({maturity:'13+'});});assert.equal(await page.evaluate(()=>contentAllowed({id:104,type:'movie'})),true);assert.equal(await page.evaluate(()=>contentAllowed({id:203,type:'tv'})),false);
  await page.evaluate(()=>updateCurrentPreferences({maturity:'16+'}));assert.equal(await page.evaluate(()=>contentAllowed({id:203,type:'tv'})),true);
  // A late title response cannot open on a different profile.
  let release;hold=new Promise(done=>release=done);await page.evaluate(()=>{window.delayedAgeOpen=openItem('movie',106);});await page.waitForFunction(()=>state.titleOpenRequest>0);await page.evaluate(()=>{state.account.activeProfileId='main';state.route='home';render();});release();await page.evaluate(()=>window.delayedAgeOpen);assert.equal(await page.evaluate(()=>state.route),'home');hold=null;
  assert.equal(await page.evaluate(()=>profileMaturity()),'18+');await page.evaluate(()=>openItem('movie',102));await page.waitForSelector('.detail');assert.match(await page.locator('.media-info').innerText(),/R \(US\)/);
  await page.locator('[data-play-movie]').click();await page.waitForSelector('iframe.player');
  assert.deepEqual(errors,[]);console.log('PASS age classifications, saved surfaces, direct/party playback, retries, profile races',width);await context.close();
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
