const crypto=require('node:crypto');
const id='11111111-1111-4111-8111-111111111111',sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',factorId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(){
 const calls=[],buckets=new Map(),sessions=new Map();let serial=0;
 const state={rateBroken:false,breached:false,pwnedBroken:false,mfa:false,unverified:false,emailEnabled:false,emailProof:false,confirmSignup:false,otp:false,emailChallenge:null,account:{onboardingComplete:true,activeProfileId:'main',profiles:[{id:'main',name:'Main',kids:false,preferences:{introEnabled:false}}],preferences:{introEnabled:false}}};
 const user=()=>({id,email:'member@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',factors:state.mfa||state.unverified?[{id:factorId,factor_type:'totp',status:state.mfa?'verified':'unverified'}]:[],user_metadata:{seven_account:state.account,seven_settings_revision:0}});
 function issue(aal='aal1'){const token='x.'+Buffer.from(JSON.stringify({sub:id,session_id:sid,aal,amr:[{method:'password'}],exp:Math.floor(Date.now()/1000)+3600,serial:++serial})).toString('base64url')+'.signature',refresh='refresh-secret-'+serial;const result={access_token:token,refresh_token:refresh,expires_in:3600,user:user()};sessions.set(refresh,{aal,token});return result;}
 const legacy=issue();
 return {state,calls,issue,legacy,user,fetch:async(url,options={})=>{
  const u=new URL(url),body=options.body?JSON.parse(options.body):null;calls.push({url:String(url),options,body});
  if(u.pathname.endsWith('/rpc/seven_auth_rate_limit')){if(state.rateBroken)return Response.json({error:'private internal details'},{status:503});let allowed=true;for(const b of body.p_buckets){const count=(buckets.get(b.key)||0)+1;buckets.set(b.key,count);if(count>b.limit)allowed=false;}return Response.json({allowed,retry_after:allowed?0:60});}
  if(u.hostname==='api.pwnedpasswords.com'){if(state.pwnedBroken)return new Response('no',{status:503});const suffix=crypto.createHash('sha1').update('a strong unique passphrase').digest('hex').toUpperCase().slice(5);return new Response((state.breached?suffix:'0'.repeat(35))+':'+(state.breached?'52':'0'));}
  if(u.pathname==='/auth/v1/token'){
   if(u.searchParams.get('grant_type')==='refresh_token'){const record=sessions.get(body.refresh_token);if(!record)return Response.json({error:'Invalid refresh'},{status:400});sessions.delete(body.refresh_token);return Response.json(issue(record.aal));}
   if(body.password!=='existing8')return Response.json({error:'database says member exists'},{status:400});return Response.json(issue());
  }
  const token=(options.headers?.Authorization||'').replace(/^Bearer /,''),known=[...sessions.values()].some(s=>s.token===token);
  if(u.pathname==='/auth/v1/user'){if(!known)return Response.json({error:'Invalid token'},{status:401});return Response.json(user());}
  if(u.pathname.endsWith('/rpc/seven_device_session_status'))return Response.json({active:true});
  if(u.pathname.endsWith('/rpc/seven_email_security')){
   if(body.p_action==='status')return Response.json({active:true,confirmed:true,enabled:state.emailEnabled,required:state.emailEnabled&&!state.emailProof});
   if(body.p_action==='start'){state.emailChallenge={id:crypto.randomUUID(),purpose:body.p_purpose};return Response.json({id:state.emailChallenge.id});}
   const c=state.emailChallenge;if(!c||c.used||c.id!==body.p_challenge)return Response.json({valid:false});
   if(body.p_action==='cancel'){c.used=true;return Response.json({ok:true});}
   if(body.p_action==='attempt')return Response.json({valid:true,purpose:c.purpose});
   if(body.p_action==='finish'){c.used=true;state.emailProof=true;if(c.purpose==='enable')state.emailEnabled=true;if(c.purpose==='disable')state.emailEnabled=false;return Response.json({valid:true,enabled:state.emailEnabled});}
  }
  if(u.pathname==='/auth/v1/otp'||u.pathname==='/auth/v1/resend'){state.otp=true;return Response.json({});}
  if(u.pathname==='/auth/v1/verify'){if((body.token!==(state.emailCode||'112233')&&!(state.tokenHash&&body.token_hash===state.tokenHash))||!state.otp)return Response.json({error:'Incorrect email code'},{status:400});state.otp=false;return Response.json(issue());}
  if(u.pathname==='/auth/v1/signup'){if(state.confirmSignup){state.otp=true;return Response.json({user:user()});}return Response.json(issue());}
  if(u.pathname==='/auth/v1/logout'){if(state.logoutBroken)return Response.json({error:'Unavailable'},{status:503});for(const [key,value]of sessions)if(value.token===token)sessions.delete(key);return new Response(null,{status:204});}
  if(u.pathname==='/auth/v1/factors'&&options.method==='POST'){state.unverified=true;return Response.json({id:factorId,totp:{secret:'SETUPKEYONLYINMODAL',uri:'otpauth://totp/SEVEN'}});}
  if(u.pathname.endsWith('/challenge'))return Response.json({id:'challenge-fixture'});
  if(u.pathname.endsWith('/verify')){if(body.code!=='123456')return Response.json({error:'Incorrect code'},{status:422});state.mfa=true;state.unverified=false;return Response.json(issue('aal2'));}
  if(u.pathname==='/auth/v1/factors/'+factorId&&options.method==='DELETE'){state.mfa=false;state.unverified=false;return Response.json({id:factorId});}
  if(u.pathname.endsWith('/rpc/seven_settings_sync'))return Response.json({account:{profiles:[{id:'main'}]},revision:0});
  throw Error('Unexpected security fixture URL '+url);
 }};
}
module.exports=fixture;
