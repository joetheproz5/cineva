// Optional Chrome regression suite. All APIs and images are local fixtures, including SEVEN_LIVE=1.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
});
const movie=(id,name)=>({id,type:'movie',title:name,overview:'The story continues.',backdrop_path:`/spotlight-${id}.svg`,poster_path:`/poster-${id}.svg`,release_date:'2020-01-01',vote_average:8,genre_ids:[18]});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#173a44"/><circle cx="950" cy="300" r="200" fill="#b82132"/></svg>';
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=process.env.SEVEN_LIVE?'https://seven-9fm.pages.dev':'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const [width,reducedMotion] of [[1440,'no-preference'],[390,'no-preference'],[390,'reduce']]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion,serviceWorkers:'block'}),page=await context.newPage(),errors=[],gates=new Map(),requests=new Map(),seen=new Map(),bad=new Set();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  function hold(name){let resolve;const promise=new Promise(done=>{resolve=done;});gates.set(name,promise);return()=>{gates.delete(name);resolve();};}
  function requested(name){if(requests.has(name))return Promise.resolve();return new Promise(resolve=>seen.set(name,resolve));}
  await context.addInitScript(()=>localStorage.setItem('seven.account.settings',JSON.stringify({preferences:{introEnabled:false,autoplayPreviews:false}})));
  await page.route('**/api/**',route=>{const url=new URL(route.request().url());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/tv/71712')?{id:71712,name:'Boot',type:'tv',backdrop_path:'/boot.svg',genres:[{id:18}]}:{results:[],total_pages:1})});});
  await page.route('https://image.tmdb.org/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);requests.set(name,(requests.get(name)||0)+1);seen.get(name)?.();if(gates.has(name))await gates.get(name);
   await route.fulfill({status:bad.has(name)?404:200,contentType:'image/svg+xml',body:bad.has(name)?'Unavailable':svg});
  });
  await page.goto(origin);await page.waitForSelector('.spotlight-slide');await page.evaluate(()=>document.querySelector('.seven-intro')?.remove());
  const releaseOne=hold('spotlight-101.svg'),releaseTwo=hold('spotlight-102.svg');
  await page.evaluate(pool=>{state.featuredPool=pool;state.featuredIndex=0;state.featured=pool[0];render();},[movie(101,'Slide One'),movie(102,'Slide Two'),movie(103,'Slide Three')]);
  await Promise.all([requested('spotlight-101.svg'),requested('spotlight-102.svg')]);
  assert.equal(await page.locator('#featured h1').count(),0,'Initial title waits for artwork');releaseOne();await page.waitForFunction(()=>state.featuredIndex===0&&!!document.querySelector('.spotlight-slide'));
  assert.match(await page.locator('#featured h1').innerText(),/Slide\s*One/);
  await page.locator('[data-hero-direction="1"]').click();await page.waitForFunction(()=>document.querySelector('#featured').getAttribute('aria-busy')==='true');
  assert.equal(await page.evaluate(()=>state.featuredIndex),0);assert.equal(await page.locator('#featured h1').count(),1);assert.match(await page.locator('#featured h1').innerText(),/Slide\s*One/);
  assert.equal(await page.locator('.hero-counter b').innerText(),'01');assert.equal(requests.get('spotlight-102.svg'),1,'Preload is reused');
  releaseTwo();await page.waitForFunction(()=>state.featuredIndex===1);
  if(reducedMotion!=='reduce'){
   const frames=await page.locator('#featured').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect?.getKeyframes().some(f=>String(f.transform||'').includes('translateX'))).flatMap(a=>a.effect.getKeyframes().map(f=>String(f.transform||''))));
   assert.ok(frames.some(value=>value.includes('translateX(')));assert.ok(frames.every(value=>!value.includes('translateY')));
  }
  await page.waitForFunction(()=>!document.querySelector('#featured').hasAttribute('aria-busy'));assert.equal(await page.locator('.spotlight-slide').count(),1);assert.match(await page.locator('#featured h1').innerText(),/Slide\s*Two/);
  await requested('spotlight-103.svg');assert.equal(await page.locator('#featured .home-hero-content').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#featured').screenshot({path:path.join(require('node:os').tmpdir(),`seven-spotlight-${width}-${reducedMotion}.png`)});
  await page.locator('[data-hero-direction="-1"]').click();await page.waitForFunction(()=>state.featuredIndex===0&&!document.querySelector('#featured').hasAttribute('aria-busy'));
  // Two rapid requests: an earlier late image cannot replace the latest chosen title.
  const releaseFive=hold('spotlight-105.svg'),releaseSix=hold('spotlight-106.svg');
  await page.evaluate(pool=>{state.featuredPool=pool;state.featuredIndex=0;state.featured=pool[0];render();},[movie(104,'Slide Four'),movie(105,'Slide Five'),movie(106,'Slide Six')]);await page.waitForSelector('[data-spotlight-title="movie:104"]');
  await page.locator('[data-hero-direction="1"]').click();await page.locator('[data-hero-direction="1"]').click();await requested('spotlight-106.svg');releaseFive();assert.equal(await page.evaluate(()=>state.featuredIndex),0);releaseSix();await page.waitForFunction(()=>state.featuredIndex===2&&!document.querySelector('#featured').hasAttribute('aria-busy'));assert.match(await page.locator('#featured h1').innerText(),/Slide\s*Six/);
  // A failed backdrop holds the previous title until the fallback poster has loaded too.
  bad.add('spotlight-108.svg');const releasePoster=hold('poster-108.svg');
  await page.evaluate(pool=>{state.featuredPool=pool;state.featuredIndex=0;state.featured=pool[0];render();},[movie(107,'Slide Seven'),movie(108,'Slide Eight')]);await page.waitForSelector('[data-spotlight-title="movie:107"]');await requested('poster-108.svg');await page.locator('[data-hero-direction="1"]').click();assert.match(await page.locator('#featured h1').innerText(),/Slide\s*Seven/);releasePoster();await page.waitForFunction(()=>state.featuredIndex===1&&!document.querySelector('#featured').hasAttribute('aria-busy'));assert.ok(await page.locator('.home-hero-backdrop').evaluate(el=>el.style.backgroundImage.includes('poster-108.svg')));
  const releaseTen=hold('spotlight-110.svg');await page.evaluate(pool=>{state.featuredPool=pool;state.featuredIndex=0;state.featured=pool[0];render();},[movie(109,'Slide Nine'),movie(110,'Slide Ten')]);await page.waitForSelector('[data-spotlight-title="movie:109"]');await page.locator('[data-hero-direction="1"]').click();await page.evaluate(()=>{state.route='my-list';render();});releaseTen();await page.waitForTimeout(100);assert.equal(await page.locator('#featured').count(),0);assert.equal(await page.evaluate(()=>state.route),'my-list');
  assert.deepEqual(errors,[]);console.log('PASS ready-only horizontal spotlight',width,reducedMotion);await context.close();
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
