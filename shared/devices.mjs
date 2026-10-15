const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder(),reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const identities=new Map();
const denied=()=>reply({error:'This device has been signed out. Please sign in again.',code:'SEVEN_SESSION_REVOKED'},401);
const tokenOf=request=>(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
export function claims(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return {};}}
export function mainProfile(user){const profiles=user?.user_metadata?.seven_account?.profiles;return Array.isArray(profiles)&&profiles.length?(profiles.find(p=>p.id==='main')||profiles[0]).id:'main';}
function settings(env){return !!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY&&(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY));}
async function upstream(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(12000)});}
async function rpc(env,name,body){
  const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,headers={apikey:key,'Content-Type':'application/json','Cache-Control':'no-store'};
  if(!env.SUPABASE_SECRET_KEY)headers.Authorization=`Bearer ${key}`;
  const response=await upstream(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error('Device management is unavailable. Please try again.');error.status=response.status;error.code=data.code;error.missing=response.status===404&&data.code==='PGRST202';throw error;}return data;
}
async function identity(request,env,cached=false){
  const token=tokenOf(request),jwt=claims(token);if(!UUID.test(jwt.session_id||'')||!UUID.test(jwt.sub||''))return null;
  if(Number(jwt.exp)&&Number(jwt.exp)*1000<=Date.now())return null;
  const key=cached?env.SUPABASE_URL+':'+b64(await crypto.subtle.digest('SHA-256',encoder.encode(token))):'',saved=identities.get(key);
  if(cached&&saved&&saved.until>Date.now())return {token,user:{id:saved.id},sid:jwt.session_id};
  const response=await upstream(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,'Cache-Control':'no-store'}});
  if(!response.ok){if([401,403].includes(response.status))return null;throw Error('Account verification is unavailable.');}
  const user=await response.json();if(user.id!==jwt.sub)return null;
  if(cached){if(identities.size>=128)identities.delete(identities.keys().next().value);identities.set(key,{id:user.id,until:Math.min(Date.now()+30000,Number(jwt.exp)*1000||Infinity)});}
  return {token,user,sid:jwt.session_id};
}
// Rollout: missing migration keeps existing account functions operational.
// Once installed, a revoked session is rejected on every protected API request.
export async function guardDeviceSession(request,env){
  if(!settings(env)||!UUID.test(claims(tokenOf(request)).session_id||''))return null;
  try{
    const actor=await identity(request,env,true);if(!actor)return reply({error:'Sign in required.',code:'SEVEN_AUTH_INVALID'},401);
    const result=await rpc(env,'seven_device_session_status',{p_user_id:actor.user.id,p_session_id:actor.sid,p_user_agent:(request.headers.get('User-Agent')||'').slice(0,600)});
    return result.active===true?null:denied();
  }catch(error){if(error.missing)return null;return reply({error:'Session verification is temporarily unavailable.'},503);}
}
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function signingKey(env){return crypto.subtle.importKey('raw',encoder.encode('seven-devices-v1:'+env.SEVEN_DASHBOARD_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function grant(actor,env,profile){const payload=b64(encoder.encode(JSON.stringify({sub:actor.user.id,sid:actor.sid,profile,exp:Math.floor(Date.now()/1000)+300})));return `${payload}.${b64(await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload)))}`;}
async function verifiedGrant(request,actor,env,profile){
  try{const [payload,signature,...extra]=(request.headers.get('X-Seven-Device-Grant')||'').split('.');if(extra.length||!payload||!signature)return false;const body=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))),bytes=Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    return body.sub===actor.user.id&&body.sid===actor.sid&&body.profile===profile&&body.exp>Math.floor(Date.now()/1000)&&body.exp<=Math.floor(Date.now()/1000)+300&&await crypto.subtle.verify('HMAC',await signingKey(env),bytes,encoder.encode(payload));
  }catch{return false;}
}
export async function handleDevices(request,env,action=''){
  if(!settings(env))return reply({error:'Device management is not configured.'},503);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Request origin rejected.'},403);
  const allowed=action==='status'||!action?'GET':'POST';if(request.method!==allowed)return reply({error:'Method not allowed.'},405);
  try{
    const actor=await identity(request,env);if(!actor)return reply({error:'Sign in required.',code:'SEVEN_AUTH_INVALID'},401);
    const status=await rpc(env,'seven_device_session_status',{p_user_id:actor.user.id,p_session_id:actor.sid,p_user_agent:(request.headers.get('User-Agent')||'').slice(0,600)});if(status.active!==true)return denied();
    if(action==='status')return reply({active:true,ready:true});
    if(actor.user.is_anonymous===true)return reply({error:'An account is required.'},403);
    const profile=mainProfile(actor.user);
    if(request.headers.get('X-Seven-Profile')!==profile)return reply({error:'Device management is only available from the main profile.'},403);
    if(!env.SEVEN_DASHBOARD_SECRET)return reply({error:'Account-security signing is not configured.'},503);
    if(action==='unlock'){
      const text=await request.text();if(text.length>4096)return reply({error:'Request is too large.'},400);const body=JSON.parse(text);
      if(typeof body.password!=='string'||!body.password||body.password.length>1024)return reply({error:'Enter your account password.'},400);
      const response=await upstream(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json','User-Agent':'SEVEN security verification'},body:JSON.stringify({email:actor.user.email,password:body.password})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)return reply({error:response.status===429?'Too many attempts. Please wait before trying again.':'That password is not correct.'},response.status===429?429:403);
      const temporary=data.access_token||data.session?.access_token,tempId=claims(temporary||'').session_id;
      // Password verification creates a temporary auth session; never retain it.
      if(temporary){
        const cleanup=await upstream(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${temporary}`}}).catch(()=>null);
        if((!cleanup||!cleanup.ok)&&data.user?.id===actor.user.id&&UUID.test(tempId||'')&&tempId!==actor.sid)await rpc(env,'seven_device_sessions_revoke',{p_user_id:actor.user.id,p_current_session:actor.sid,p_target_session:tempId,p_others:false});
      }
      if(data.user?.id!==actor.user.id||!temporary)return reply({error:'Couldn’t verify this account.'},403);
      return reply({grant:await grant(actor,env,profile),expiresIn:300});
    }
    if(!await verifiedGrant(request,actor,env,profile))return reply({error:'Confirm your account password to manage devices.',code:'SEVEN_REAUTH_REQUIRED'},403);
    if(!action){
      const rows=await rpc(env,'seven_device_sessions_list',{p_user_id:actor.user.id,p_current_session:actor.sid});
      return reply({devices:(Array.isArray(rows)?rows:[]).map(row=>({id:row.id,current:!!row.is_current,createdAt:row.created_at,lastActiveAt:row.last_active_at,userAgent:row.user_agent||''}))});
    }
    if(action==='revoke'){
      const text=await request.text();if(text.length>1024)return reply({error:'Request is too large.'},400);const body=JSON.parse(text);
      if(body.others!==true&&!UUID.test(body.sessionId||''))return reply({error:'Choose a device.'},400);
      const count=await rpc(env,'seven_device_sessions_revoke',{p_user_id:actor.user.id,p_current_session:actor.sid,p_target_session:body.others===true?null:body.sessionId,p_others:body.others===true});
      return reply({revoked:Number(count)||0,current:body.others!==true&&body.sessionId===actor.sid});
    }
    return reply({error:'Unknown device action.'},404);
  }catch(error){if(error.missing)return reply({error:'Device management needs its database migration.',code:'SEVEN_DEVICES_SETUP_REQUIRED'},503);if(error.code==='28000')return denied();return reply({error:error instanceof SyntaxError?'Invalid request.':'Device management is temporarily unavailable.'},error instanceof SyntaxError?400:503);}
}
export async function handleLogout(request,env){
  if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Request origin rejected.'},403);
  if(!tokenOf(request))return reply({error:'Sign in required.'},401);
  try{const response=await upstream(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:request.headers.get('Authorization')}});if(!response.ok&&![401,403,404].includes(response.status))return reply({error:'Couldn’t sign out on the server.'},502);return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});}catch{return reply({error:'Couldn’t reach the sign-out server.'},502);}
}
