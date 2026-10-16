// Real auth handlers and browser cookie storage; only the upstream provider is a fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT_PATH||'playwright'),root=path.resolve(__dirname,'..'),fixture=require('./auth-upstream-fixture.cjs');
const env={SUPABASE_URL:'https://security.fixture',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture',SEVEN_DASHBOARD_SECRET:'a-security-test-only-secret-at-least-32-characters'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=process.env.SEVEN_LIVE?'https://seven-9fm.pages.dev':'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true}),handler=(await import(pathToFileURL(path.resolve(root,'../functions/api/[[path]].js')).href)).onRequest,original=global.fetch;
try{for(const width of [1440,390,320]){
 const f=fixture(),errors=[],contexts=[];global.fetch=f.fetch;
 async function client({storageState,legacy=false}={}){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',...(storageState?{storageState}:{})});contexts.push(context);
  await context.addInitScript(({legacy,user,session})=>{localStorage.setItem('seven.account.settings',JSON.stringify(user.user_metadata.seven_account));if(legacy&&!sessionStorage.getItem('seeded')){localStorage.setItem('cineva.supabase.session',JSON.stringify(session));sessionStorage.setItem('seeded','yes');}},{legacy,user:f.user(),session:f.legacy});
  await context.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url()),endpoint=url.pathname.slice(5);let data={results:[],total_pages:1};
   if(endpoint.startsWith('auth/')){const response=await handler({request:new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(req.postData()?{body:req.postData()}:{})}),params:{path:endpoint},env});return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
   if(endpoint==='config')data={configured:true};
   else if(endpoint==='account/settings')data={account:f.state.account,revision:0};
   else if(endpoint==='account/parent-access')data={enabled:false};
   else if(endpoint==='account/devices/status')data={active:true,ready:true};
   else if(endpoint.startsWith('account/'))data=[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);return {page,context};
 }
 async function login(page){await page.evaluate(()=>showAuth('login'));await page.locator('#auth-form [name=email]').fill('member@example.test');await page.locator('#auth-form [name=password]').fill('existing8');await page.locator('#auth-form [type=submit]').click();}
 async function authenticated(page){await page.waitForFunction(()=>state.user?.id==='11111111-1111-4111-8111-111111111111'&&state.route==='profiles');}
 async function noSecrets(page){const values=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.doesNotMatch(values,/refresh-secret|memory-access-|SETUPKEYONLYINMODAL|existing8|access_token|refresh_token/);}
 const first=await client();await first.page.waitForSelector('.spotlight-slide');await login(first.page);await authenticated(first.page);await noSecrets(first.page);
 const cookies=await first.context.cookies(),cookie=cookies.find(c=>c.name.includes('seven_refresh'));assert.ok(cookie?.httpOnly);assert.equal(cookie.sameSite,'Lax');assert.ok(cookie.expires>Date.now()/1000+29*86400);assert.equal((await first.page.evaluate(()=>document.cookie)).includes('seven_refresh'),false);
 // CSP must prevent executable HTML even if an unsafe rendering site slips through.
 await first.page.evaluate(()=>{const el=document.createElement('div');el.innerHTML='<img src="/missing-security-fixture.png" onerror="window.securityInjected=true">';document.body.append(el);});await first.page.waitForLoadState('networkidle');assert.equal(await first.page.evaluate(()=>window.securityInjected),undefined);
 const stored=await first.context.storageState();await first.context.close();const reopened=await client({storageState:stored});await authenticated(reopened.page);await noSecrets(reopened.page);
 await reopened.page.evaluate(()=>{state.route='home';showProfileEditor('main','home','security');});await reopened.page.locator('[data-two-step]').click();await reopened.page.waitForSelector('.account-security-modal [name=password]');await reopened.page.locator('.account-security-modal [name=password]').fill('existing8');await reopened.page.locator('.account-security-modal [type=submit]').click();await reopened.page.waitForSelector('.auth-setup-key');assert.equal(f.state.mfa,false);await noSecrets(reopened.page);await reopened.page.screenshot({path:path.join(os.tmpdir(),'seven-security-setup-'+width+'.png')});
 await reopened.page.locator('.account-security-modal [name=code]').fill('999999');await reopened.page.locator('.account-security-modal [type=submit]').click();await reopened.page.waitForFunction(()=>document.querySelector('.account-security-modal [data-error]')?.textContent.includes('didn’t work'));assert.equal(f.state.mfa,false);
 await reopened.page.locator('.account-security-modal [name=code]').fill('123456');await reopened.page.locator('.account-security-modal [type=submit]').click();await reopened.page.waitForSelector('.account-security-modal',{state:'detached'});assert.equal(f.state.mfa,true);await noSecrets(reopened.page);
 // Two tabs both sign out, and the cookie is cleared rather than merely hiding the UI.
 const tab=await reopened.context.newPage();await tab.goto(origin);await authenticated(tab);await reopened.page.evaluate(()=>signOut());await reopened.page.waitForFunction(()=>!state.user);await tab.waitForFunction(()=>!state.user);await reopened.page.waitForFunction(async()=>!(await(await fetch('/api/auth/cookie-status')).json()).cookie);
 await login(reopened.page);await reopened.page.waitForSelector('.account-security-modal [name=code]');assert.equal(await reopened.page.evaluate(()=>state.user),null);await reopened.page.screenshot({path:path.join(os.tmpdir(),'seven-security-challenge-'+width+'.png')});await reopened.page.locator('.account-security-modal [name=code]').fill('123456');await reopened.page.locator('.account-security-modal [type=submit]').click();await authenticated(reopened.page);await noSecrets(reopened.page);
 assert.ok(await reopened.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 // A pre-update installation exchanges its existing refresh token; no forced logout.
 f.state.mfa=false;const migrated=await client({legacy:true});await authenticated(migrated.page);await noSecrets(migrated.page);assert.ok((await migrated.context.cookies()).some(c=>c.httpOnly&&c.name.includes('seven_refresh')));
 console.log('PASS real cookie login/reopen, legacy migration, storage hygiene, CSP, two-tab logout, TOTP setup/challenge',width);for(const context of contexts)await context.close();
 }}finally{global.fetch=original;await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
