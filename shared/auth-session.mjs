import {securityJSON,sameOrigin,boundedJSON,throttle,passwordSafety} from './auth-security.mjs';
import {guardDeviceSession,claims} from './devices.mjs';
import {emailStatus} from './email-assurance.mjs';

const encoder=new TextEncoder(),DAYS=30*86400;
const cookieName=request=>new URL(request.url).protocol==='https:'?'__Host-seven_refresh':'seven_refresh_dev';
const base64=value=>btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unbase64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),v=>v.charCodeAt(0));
async function cookieKey(env){if(!env.SEVEN_DASHBOARD_SECRET||env.SEVEN_DASHBOARD_SECRET.length<32)throw Error('Session protection is unavailable.');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('seven-refresh-v1:'+env.SEVEN_DASHBOARD_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export function clearRefreshCookie(request){return cookieName(request)+'=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'+(new URL(request.url).protocol==='https:'?'; Secure':'');}
async function refreshCookie(request,env,refresh,started){const nonce=crypto.getRandomValues(new Uint8Array(12)),data=encoder.encode(JSON.stringify({refresh,started,exp:Math.floor(Date.now()/1000)+DAYS})),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:encoder.encode(new URL(request.url).origin)},await cookieKey(env),data);return cookieName(request)+'='+base64(nonce)+'.'+base64(new Uint8Array(cipher))+'; Path=/; Max-Age='+DAYS+'; HttpOnly; SameSite=Lax'+(new URL(request.url).protocol==='https:'?'; Secure':'');}
async function storedRefresh(request,env){try{const raw=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName(request)+'='))?.slice(cookieName(request).length+1),[iv,value]=raw?.split('.')||[];if(!iv||!value)return null;const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv),additionalData:encoder.encode(new URL(request.url).origin)},await cookieKey(env),unbase64(value)),result=JSON.parse(new TextDecoder().decode(plain));return result.exp>Math.floor(Date.now()/1000)&&typeof result.refresh==='string'?result:null;}catch{return null;}}
export async function authUpstream(env,path,{token,method='GET',body}={}){const response=await fetch(env.SUPABASE_URL+path,{method,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});return {status:response.status,data:await response.json().catch(()=>({}))};}
export async function sessionReply(request,env,data,status=200,started=Date.now()){
  const session=data.session||(data.access_token?data:null);if(!session?.access_token)return securityJSON(data,status);
  if(!session.refresh_token)return securityJSON({error:'No renewable session was returned.'},502);
  const cookie=await refreshCookie(request,env,session.refresh_token,started),safe={access_token:session.access_token,expires_at:Number(session.expires_at)||Math.floor(Date.now()/1000)+(Number(session.expires_in)||3600),expires_in:Number(session.expires_in)||3600,cookie_session:true,seven_started_at:started,user:session.user||data.user||null};
  return securityJSON({session:safe,user:safe.user},status,{'Set-Cookie':cookie});
}
export async function requireMFA(request,env){
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!token)return null;
  const result=await authUpstream(env,'/auth/v1/user',{token});if(result.status>=500)return securityJSON({error:'Account verification is temporarily unavailable.'},503);if(result.status!==200)return securityJSON({error:'Sign in required.'},401);
  if(result.data.factors?.some(f=>f.status==='verified')&&claims(token).aal!=='aal2')return securityJSON({error:'Enter your authenticator code to continue.',code:'SEVEN_MFA_REQUIRED'},403);
  try{const status=await emailStatus(env,result.data,claims(token));if(!status.active)return securityJSON({error:'Sign in required.'},401);if(status.required)return securityJSON({error:'Enter the code from your email to continue.',code:'SEVEN_EMAIL_REQUIRED'},403);}catch{return securityJSON({error:'Account security is temporarily unavailable.'},503);}return null;
}
export async function cleanupVerification(env,data){const token=data.access_token||data.session?.access_token;if(token)await fetch(env.SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)}).catch(()=>{});}
export async function secureLogout(request,env){
  if(request.method!=='POST')return securityJSON({error:'Method not allowed.'},405);
  if(!sameOrigin(request))return securityJSON({error:'Request origin rejected.'},403);
  let retryCookie;
  const unavailable=()=>securityJSON({error:'Could not finish signing out. SEVEN will retry.'},503,retryCookie?{'Set-Cookie':retryCookie}:{});
  try{
    const stored=await storedRefresh(request,env);let token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
    if(stored){const renewed=await authUpstream(env,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:stored.refresh}});if(renewed.status>=500||renewed.status===429)return unavailable();if(renewed.status===200){const session=renewed.data.session||renewed.data;token=session.access_token;retryCookie=await refreshCookie(request,env,session.refresh_token,stored.started);}}
    if(token){const result=await authUpstream(env,'/auth/v1/logout?scope=local',{method:'POST',token});if(result.status>=500||result.status===429)return unavailable();}
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store','Set-Cookie':clearRefreshCookie(request)}});
  }catch{return unavailable();}
}
export async function handleAuthSession(action,request,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return securityJSON({error:'Authentication is not configured.'},503);
  const read=action==='user'||action==='cookie-status';if(request.method!==(read?'GET':'POST'))return securityJSON({error:'Method not allowed.'},405);
  if(!sameOrigin(request))return securityJSON({error:'Request origin rejected.'},403);
  try{
    if(action==='cookie-status')return securityJSON({cookie:!!await storedRefresh(request,env)});
    if(action==='user'){const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!token)return securityJSON({error:'Sign in required.'},401);const result=await authUpstream(env,'/auth/v1/user',{token});return securityJSON(result.data,result.status);}
    if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return securityJSON({error:'JSON is required.'},415);
    const body=await boundedJSON(request),email=typeof body.email==='string'?body.email.trim().toLowerCase():'',password=body.password;
    if(action==='refresh'){
      const stored=await storedRefresh(request,env),refresh=stored?.refresh||body.refresh_token;
      if(typeof refresh!=='string'||!refresh||refresh.length>1024)return securityJSON({error:'Sign in required.'},401,{'Set-Cookie':clearRefreshCookie(request)});
      // Legacy refresh tokens are exchanged once, then removed from browser storage.
      const denied=await throttle(request,env,'refresh',{limit:60,ipLimit:600,seconds:300});if(denied)return denied;
      const result=await authUpstream(env,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}});
      if(result.status!==200)return securityJSON({error:result.status===429?'Too many attempts. Please try again shortly.':'Your session could not be renewed.'},result.status, [400,401,403].includes(result.status)?{'Set-Cookie':clearRefreshCookie(request)}:{});
      const session=result.data.session||result.data,guard=await guardDeviceSession(new Request(request.url,{headers:{Authorization:'Bearer '+session.access_token,'User-Agent':request.headers.get('User-Agent')||''}}),env);if(guard)return new Response(guard.body,{status:guard.status,headers:{...Object.fromEntries(guard.headers),'Set-Cookie':clearRefreshCookie(request)}});
      return sessionReply(request,env,result.data,200,stored?.started||Date.now());
    }
    if(['resend-verification','verify-email'].includes(action)){
      const link=action==='verify-email'&&typeof body.tokenHash==='string';
      if(link?!/^[A-Za-z0-9_-]{40,256}$/.test(body.tokenHash):(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return securityJSON({error:link?'This verification link is incomplete. Request a new email.':'Enter a valid email address.'},400);
      const denied=await throttle(request,env,action,{identity:link?'link':email,limit:action==='verify-email'?8:3,seconds:600,ipLimit:action==='verify-email'?30:12});if(denied)return denied;
      if(action==='resend-verification'){
        const resent=await authUpstream(env,'/auth/v1/resend'+(env.SUPABASE_EMAIL_REDIRECT_TO?'?redirect_to='+encodeURIComponent(env.SUPABASE_EMAIL_REDIRECT_TO):''),{method:'POST',body:{email,type:'signup'}});
        if(resent.status>=500)return securityJSON({error:'Could not send the email. Please try again.'},503);
        if(resent.status===429)return securityJSON({error:'Please wait before requesting another email.'},429,{'Retry-After':'60'});
        return securityJSON({ok:true,message:'If this account needs verification, a new email is on its way.'});
      }
      if(!link&&!/^(?:\d{6}|\d{8})$/.test(body.code||''))return securityJSON({error:'Enter the complete code from your email.'},400);
      const verification=await authUpstream(env,'/auth/v1/verify',{method:'POST',body:link?{token_hash:body.tokenHash,type:'signup'}:{email,token:body.code,type:'signup'}});
      if(verification.status>=500)return securityJSON({error:'Email verification is temporarily unavailable. Please try again.'},503);
      if(verification.status===429)return securityJSON({error:'Please wait before trying to verify again.'},429,{'Retry-After':'60'});
      const user=verification.data.user||verification.data.session?.user;
      const confirmed=verification.status===200&&user?.email_confirmed_at&&user.email&&(link||String(user.email).toLowerCase()===email);
      await cleanupVerification(env,verification.data);
      if(!confirmed)return securityJSON({error:link?'This link has expired or already been used. Try signing in, or request a new verification email.':'That code did not work. Try again or request a new email.',...(link?{code:'SEVEN_EMAIL_LINK_EXPIRED'}:{})},400);
      return securityJSON({verified:true,email:String(user.email).toLowerCase()});
    }
    if(!['login','signup'].includes(action))return securityJSON({error:'Unknown auth action.'},404);
    const limited=await throttle(request,env,action,{identity:email,limit:10,ipLimit:40,seconds:900});if(limited)return limited;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return securityJSON({error:'Enter a valid email address.'},400);
    if(typeof password!=='string'||!password||password.length>1024)return securityJSON({error:'Enter your email and password.'},400);
    if(action==='signup'){const safe=await passwordSafety(password);if(safe)return safe;}
    const route=action==='login'?'/auth/v1/token?grant_type=password':'/auth/v1/signup'+(env.SUPABASE_EMAIL_REDIRECT_TO?'?redirect_to='+encodeURIComponent(env.SUPABASE_EMAIL_REDIRECT_TO):'');
    const payload=action==='login'?{email,password}:{email,password,data:{display_name:String(body.displayName||'').slice(0,50),seven_account:{onboardingComplete:false,onboardingStep:1}}};
    const result=await authUpstream(env,route,{method:'POST',body:payload});
    if(result.status>=400){if(action==='login'&&result.data.error_code==='email_not_confirmed')return securityJSON({error:'Verify your email before signing in.',code:'SEVEN_EMAIL_UNCONFIRMED'},403);return securityJSON({error:result.status===429?'Too many attempts. Please wait before trying again.':action==='login'?'That email or password didn’t work.':'Could not create this account. Try signing in or resetting your password.'},result.status);}
    return sessionReply(request,env,result.data,result.status);
  }catch(error){return securityJSON({error:[400,413].includes(error.status)?error.message:'Authentication is temporarily unavailable. Please try again.'},[400,413].includes(error.status)?error.status:503);}
}
