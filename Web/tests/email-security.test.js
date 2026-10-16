const test=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path'),crypto=require('node:crypto');
const backend=import(pathToFileURL(path.resolve(__dirname,'../../functions/api/[[path]].js')).href),baseFixture=require('../qa/auth-upstream-fixture.cjs');
const env={SUPABASE_URL:'https://security.fixture',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture',SEVEN_DASHBOARD_SECRET:'a-security-test-only-secret-at-least-32-characters'};
function fixture(){const f=baseFixture(),original=f.fetch;Object.assign(f.state,{emailEnabled:false,emailProof:false,mailBroken:false,otp:false,challenge:null});f.fetch=async(url,options={})=>{
 const u=new URL(url),b=options.body?JSON.parse(options.body):{},s=f.state;
 if(u.pathname.endsWith('/rpc/seven_email_security')){
  if(s.storeBroken)return Response.json({error:'private database error'},{status:500});
  if(b.p_action==='status')return Response.json({active:true,confirmed:true,enabled:s.emailEnabled,required:s.emailEnabled&&!s.emailProof});
  if(b.p_action==='start'){if((b.p_purpose==='enable')===s.emailEnabled)return Response.json({conflict:true});s.challenge={id:crypto.randomUUID(),purpose:b.p_purpose,attempts:0};return Response.json({id:s.challenge.id});}
  const c=s.challenge;if(!c||c.used||c.id!==b.p_challenge||c.attempts>=6)return Response.json({valid:false});
  if(b.p_action==='cancel'){c.used=true;return Response.json({ok:true});}
  if(b.p_action==='attempt'){c.attempts++;return Response.json({valid:true,purpose:c.purpose});}
  if(b.p_action==='finish'){c.used=true;s.emailProof=true;if(c.purpose==='enable')s.emailEnabled=true;if(c.purpose==='disable')s.emailEnabled=false;return Response.json({valid:true,enabled:s.emailEnabled});}
 }
 if(u.pathname==='/auth/v1/otp'){assert.equal(b.create_user,false);assert.equal(b.email,'member@example.test');s.otp=true;return Response.json(s.mailBroken?{error:'SMTP internal error'}:{},{status:s.mailBroken?500:200});}
 if(u.pathname==='/auth/v1/verify'){if(b.token!=='112233'||!s.otp)return Response.json({error:'wrong code'},{status:400});s.otp=false;return Response.json(f.issue());}
 if(u.pathname==='/auth/v1/resend')return Response.json({});
 return original(url,options);
 };return f;}
async function run(f,task){const saved=global.fetch;global.fetch=f.fetch;try{await task();}finally{global.fetch=saved;}}
async function req(action,token,body,profile='main',method='POST'){return(await backend).onRequest({request:new Request('https://seven.test/api/'+action,{method,headers:{Origin:'https://seven.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.20','X-Seven-Profile':profile,...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),params:{path:action},env});}
test('email enrollment requires main profile, password and an owned email code; no OTP session leaks',async()=>{const f=fixture();await run(f,async()=>{const token=f.legacy.access_token;
 assert.equal((await req('auth/email/send',token,{purpose:'enable',password:'existing8'},'kids')).status,403);
 assert.equal((await req('auth/email/send',token,{purpose:'enable',password:'wrong'})).status,403);
 const started=await req('auth/email/send',token,{purpose:'enable',password:'existing8'});assert.equal(started.status,200);const {id}=await started.json();assert.equal(f.state.emailEnabled,false);
 assert.equal((await req('auth/email/verify',token,{id,code:'999999'})).status,400);assert.equal(f.state.emailEnabled,false);
 const verified=await req('auth/email/verify',token,{id,code:'112233'});assert.equal(verified.status,200);const result=await verified.json();assert.equal(result.enabled,true);assert.doesNotMatch(JSON.stringify(result),/access_token|refresh_token|refresh-secret/);assert.equal(verified.headers.has('set-cookie'),false);
 assert.equal((await req('auth/email/verify',token,{id,code:'112233'})).status,400);assert.ok(f.calls.some(c=>c.url.includes('/logout?scope=local')));
 });});
test('email-enabled account cannot read settings or alter authenticator before email proof',async()=>{const f=fixture();f.state.emailEnabled=true;await run(f,async()=>{const token=f.legacy.access_token;
 assert.equal((await req('account/settings',token,undefined,'main','GET')).status,403);
 assert.equal((await req('auth/mfa/enroll',token,{password:'existing8'})).status,403);
 const started=await(await req('auth/email/send',token,{purpose:'signin'})).json();await req('auth/email/verify',token,{id:started.id,code:'112233'});
 assert.equal((await req('account/settings',token,undefined,'main','GET')).status,200);
 });});
test('authenticator is not bypassed by email, and disabling email requires fresh password and email proof',async()=>{const f=fixture();f.state.emailEnabled=true;f.state.emailProof=true;f.state.mfa=true;await run(f,async()=>{
 assert.equal((await req('auth/email/send',f.legacy.access_token,{purpose:'disable',password:'existing8'})).status,403);
 const token=f.issue('aal2').access_token;assert.equal((await req('auth/email/send',token,{purpose:'disable'})).status,400);
 const started=await(await req('auth/email/send',token,{purpose:'disable',password:'existing8'})).json();assert.equal(f.state.emailEnabled,true);
 assert.equal((await req('auth/email/verify',token,{id:started.id,code:'112233'})).status,200);assert.equal(f.state.emailEnabled,false);assert.equal(f.state.mfa,true);
 });});
test('failed mail delivery and database failure cannot enable email security or disclose internals',async()=>{const f=fixture();f.state.mailBroken=true;await run(f,async()=>{const token=f.legacy.access_token,r=await req('auth/email/send',token,{purpose:'enable',password:'existing8'});assert.equal(r.status,503);assert.equal(f.state.emailEnabled,false);assert.doesNotMatch(await r.text(),/SMTP internal/);f.state.storeBroken=true;const denied=await req('account/settings',token,undefined,'main','GET');assert.equal(denied.status,503);assert.doesNotMatch(await denied.text(),/private database/);});});
test('signup resend is generic and signup code verification returns no credentials',async()=>{const f=fixture();await run(f,async()=>{const resend=await req('auth/resend-verification',null,{email:'member@example.test'});assert.equal(resend.status,200);assert.equal((await resend.json()).ok,true);f.state.otp=true;const r=await req('auth/verify-email',null,{email:'member@example.test',code:'112233'});assert.equal(r.status,200);const d=await r.json();assert.equal(d.verified,true);assert.doesNotMatch(JSON.stringify(d),/access_token|refresh_token/);assert.equal(r.headers.has('set-cookie'),false);});});
