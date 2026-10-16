const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const source=fs.readFileSync(path.resolve(__dirname,'../devices.js'),'utf8'),backend=import(pathToFileURL(path.resolve(__dirname,'../../shared/devices.mjs')).href);
const userId='11111111-1111-4111-8111-111111111111',sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',temp='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const jwt=(session=sid,user=userId)=>`x.${Buffer.from(JSON.stringify({sub:user,session_id:session})).toString('base64url')}.signature`;
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SECRET_KEY:'private-fixture',SEVEN_DASHBOARD_SECRET:'test-signing-key-not-a-real-secret'};
function fixture(){
 const calls=[],active=new Set([sid,other]);let badPassword=false,missing=false,broken=false;
 return {calls,active,setBad:value=>badPassword=value,setMissing:value=>missing=value,setBroken:value=>broken=value,fetch:async(url,options={})=>{
  const u=new URL(url),body=options.body?JSON.parse(options.body):null;calls.push({url:String(url),options,body});
  if(u.pathname.endsWith('/rpc/seven_auth_rate_limit'))return Response.json({allowed:true});
  if(u.pathname==='/auth/v1/user')return Response.json({id:userId,email:'fixture@example.test',is_anonymous:false,user_metadata:{seven_account:{profiles:[{id:'main'},{id:'kids',kids:true}]}}});
  if(u.pathname.endsWith('/token'))return badPassword?Response.json({error:'Invalid password'},{status:400}):Response.json({access_token:jwt(temp),user:{id:userId}});
  if(u.pathname.endsWith('/logout'))return new Response(null,{status:204});
  if(missing)return Response.json({code:'PGRST202'},{status:404});if(broken)return Response.json({code:'XX000'},{status:500});
  if(u.pathname.endsWith('seven_device_session_status'))return Response.json({active:active.has(body.p_session_id)});
  if(u.pathname.endsWith('seven_device_sessions_list'))return Response.json([...active].map(id=>({id,is_current:id===body.p_current_session,user_agent:'Mozilla/5.0 (Windows NT 10.0) Chrome/130',created_at:'2026-10-14T10:00:00Z',last_active_at:'2026-10-15T10:00:00Z'})));
  if(u.pathname.endsWith('seven_device_sessions_revoke')){let count=0;for(const id of [...active])if(body.p_others?id!==body.p_current_session:id===body.p_target_session){active.delete(id);count++;}return Response.json(count);}
  throw Error('Unexpected fixture URL '+u.pathname);
 }};
}
function request(action='',{profile='main',grant,body,token=jwt(),origin}={}){return new Request('https://seven.test/api/account/devices'+(action?'/'+action:''),{method:action&&action!=='status'?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'X-Seven-Profile':profile,...(grant?{'X-Seven-Device-Grant':grant}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});}
test('main-profile password gate lists real sessions without leaking tokens or IPs',async()=>{
 const api=await backend,original=global.fetch,f=fixture();global.fetch=f.fetch;
 try{
  assert.equal((await api.handleDevices(request('',{profile:'kids'}),env)).status,403);assert.equal((await api.handleDevices(request(),env)).status,403);
  const response=await api.handleDevices(request('unlock',{body:{password:'fixture-password'}}),env,'unlock'),unlock=await response.json();assert.equal(response.status,200);assert.ok(unlock.grant);assert.equal(unlock.expiresIn,300);assert.ok(f.calls.some(c=>c.url.endsWith('/logout?scope=local')&&c.options.headers.Authorization===`Bearer ${jwt(temp)}`));
  const listed=await api.handleDevices(request('',{grant:unlock.grant}),env),data=await listed.json();assert.equal(data.devices.length,2);assert.equal(data.devices[0].current,true);assert.equal(data.devices[0].userAgent.includes('Windows'),true);assert.doesNotMatch(JSON.stringify(data),/private-fixture|access_token|refresh_token|fixture@example|"ip"/);
  assert.ok(f.calls.filter(c=>c.url.includes('/rest/v1/rpc/')).every(c=>c.options.headers.apikey==='private-fixture'&&!c.options.headers.Authorization));
 }finally{global.fetch=original;}
});
test('incorrect passwords, forged/replayed grants, other profiles and origins cannot revoke',async()=>{
 const api=await backend,original=global.fetch,f=fixture();global.fetch=f.fetch;
 try{f.setBad(true);assert.equal((await api.handleDevices(request('unlock',{body:{password:'wrong'}}),env,'unlock')).status,403);f.setBad(false);
 const grant=(await(await api.handleDevices(request('unlock',{body:{password:'correct'}}),env,'unlock')).json()).grant;
 for(const args of [{grant:'forged'},{grant,profile:'kids'},{grant,token:jwt(other)},{grant,origin:'https://evil.example'}])assert.equal((await api.handleDevices(request('revoke',{...args,body:{others:true}}),env,'revoke')).status,403);assert.equal(f.active.size,2);
 const result=await api.handleDevices(request('revoke',{grant,body:{others:true}}),env,'revoke');assert.equal(result.status,200);assert.deepEqual(await result.json(),{revoked:1,current:false});assert.ok(f.active.has(sid));assert.ok(!f.active.has(other));
 }finally{global.fetch=original;}
});
test('revoked sessions fail every guarded API; missing migration rolls out safely but outages fail closed',async()=>{
 const api=await backend,original=global.fetch,f=fixture();global.fetch=f.fetch;
 try{const req=request();assert.equal(await api.guardDeviceSession(req,env),null);f.active.delete(sid);let response=await api.guardDeviceSession(req,env);assert.equal(response.status,401);assert.equal((await response.json()).code,'SEVEN_SESSION_REVOKED');f.setMissing(true);assert.equal(await api.guardDeviceSession(req,env),null);f.setMissing(false);f.setBroken(true);assert.equal((await api.guardDeviceSession(req,env)).status,503);assert.equal(await api.guardDeviceSession(request('',{token:'not-a-jwt'}),env),null);}
 finally{global.fetch=original;}
});
test('individual revocation is scoped to the verified owner and current logout uses local scope',async()=>{
 const api=await backend,original=global.fetch,f=fixture();global.fetch=f.fetch;
 try{const grant=(await(await api.handleDevices(request('unlock',{body:{password:'correct'}}),env,'unlock')).json()).grant;await api.handleDevices(request('revoke',{grant,body:{sessionId:other,userId:'injected'}}),env,'revoke');const payload=f.calls.find(c=>c.url.endsWith('seven_device_sessions_revoke')).body;assert.equal(payload.p_user_id,userId);assert.equal(payload.p_current_session,sid);assert.equal(payload.p_target_session,other);assert.equal(payload.p_others,false);
 const response=await api.handleLogout(new Request('https://seven.test/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${jwt()}`}}),env);assert.equal(response.status,204);assert.ok(f.calls.at(-1).url.endsWith('?scope=local'));}
 finally{global.fetch=original;}
});
function client(){
 const removed=[],context={state:{user:{id:userId},session:{access_token:jwt(),user:{id:userId}},account:{activeProfileId:'main',profiles:[{id:'main',name:'Renamed owner'},{id:'kids'}]}},Date,Math,JSON,atob,clearInterval,setInterval:()=>1,document:{hidden:false,addEventListener(){},querySelector:()=>null},accountWatchlistUserId:()=>userId,activeProfileId:()=>context.state.account.activeProfileId,currentProfile:()=>context.state.account.profiles.find(p=>p.id===context.state.account.activeProfileId),accessTokenExpiresSoon:()=>false,authorizedHeaders:()=>({}),localAPI:async()=>({active:true}),clearSession:()=>{removed.push(true);context.state.session=null;},resetAppNavigation(){},render(){},showToast(){},window:{addEventListener(){}}};vm.createContext(context);vm.runInContext(source,context);return {context,api:context.window.SEVENDevices,removed};
}
test('client access is main-profile only, independent of profile name, and guest-safe',()=>{
 const {context,api}=client();assert.equal(api.isMain(),true);context.state.account.activeProfileId='kids';assert.equal(api.isMain(),false);context.state.account.activeProfileId='main';assert.equal(api.isMain({id:'kids'}),false);context.accountWatchlistUserId=()=>null;assert.equal(api.isMain(),false);assert.equal(api.deviceName('Mozilla/5.0 (Windows NT 10.0) Chrome/130'),'Chrome · Windows');assert.equal(api.deviceName(''),'Unrecognized browser');
});
test('late revocation errors from a previous session cannot sign out a new login',()=>{
 const {context,api,removed}=client(),old=jwt();context.state.session.access_token=jwt(other);api.rejected({code:'SEVEN_SESSION_REVOKED'},old);assert.equal(removed.length,0);api.rejected({code:'SEVEN_SESSION_REVOKED'},jwt(other));assert.equal(removed.length,1);
});
test('SQL migration restricts privileged RPCs and ties device activity/refresh tokens to auth sessions',()=>{
 const sql=fs.readFileSync(path.resolve(__dirname,'../supabase-devices.sql'),'utf8');assert.match(sql,/references auth\.sessions\(id\) on delete cascade/);assert.match(sql,/delete from auth\.sessions where user_id=p_user_id and id<>p_current_session/);assert.match(sql,/as restrictive for all to authenticated/);assert.match(sql,/revoke all on function public\.seven_device_sessions_revoke[^;]+from public,anon,authenticated/);assert.match(sql,/grant execute on function public\.seven_device_sessions_revoke[^;]+to service_role/);
});
