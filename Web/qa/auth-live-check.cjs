// Non-member live probes only. No valid account/password, enrollment or real user mutation.
const assert=require('node:assert/strict');
(async()=>{
 const origin='https://seven-9fm.pages.dev',send=(path,body,headers={})=>fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json',Origin:origin,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const page=await fetch(origin+'/',{cache:'no-store'});assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal(page.headers.get('x-frame-options'),'DENY');assert.ok((await page.text()).includes('app.js?v=379'));
 assert.equal((await send('admin/stats',undefined,{'X-Admin':'true'})).status,401);assert.equal((await send('account/settings')).status,401);assert.equal((await send('auth/mfa/status')).status,401);
 const cross=await send('auth/login',{},{Origin:'https://example.invalid'});assert.equal(cross.status,403);
 const refresh=await send('auth/refresh',{});assert.equal(refresh.status,401);assert.match(refresh.headers.get('set-cookie'),/^__Host-seven_refresh=.*HttpOnly.*Secure/);
 const login=await send('auth/login',{email:'seven-security-probe@example.invalid',password:'not-a-real-member-password'});assert.equal(login.status,400);assert.equal((await login.json()).error,'That email or password didn’t work.');
 const weak=await send('auth/signup',{email:'seven-security-probe@example.invalid',password:'short'});assert.equal(weak.status,400);assert.equal((await weak.json()).code,'SEVEN_WEAK_PASSWORD');
 const breached=await send('auth/signup',{email:'seven-security-probe@example.invalid',password:'passwordpassword'});assert.equal(breached.status,400);assert.equal((await breached.json()).code,'SEVEN_BREACHED_PASSWORD');
 console.log('PASS live build/CSP, server admin/account/MFA guards, CSRF, protected cookie clearing, shared auth protection and breached-password rejection');
})().catch(error=>{console.error(error);process.exitCode=1;});
