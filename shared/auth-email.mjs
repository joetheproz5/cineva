import {securityJSON,sameOrigin,boundedJSON,throttle} from './auth-security.mjs';
import {authUpstream,cleanupVerification} from './auth-session.mjs';
import {claims,mainProfile} from './devices.mjs';
import {emailRPC,emailStatus,passwordSession} from './email-assurance.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleEmailSecurity(action,request,env){
 if(!sameOrigin(request))return securityJSON({error:'Request origin rejected.'},403);
 if(request.method!==(action==='status'?'GET':'POST'))return securityJSON({error:'Method not allowed.'},405);
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!token)return securityJSON({error:'Sign in required.'},401);
 try{
  const identity=await authUpstream(env,'/auth/v1/user',{token});
  if(identity.status!==200)return securityJSON({error:'Sign in required.'},identity.status>=500?503:401);
  const user=identity.data,jwt=claims(token);
  if(jwt.sub!==user.id||!UUID.test(jwt.session_id||''))return securityJSON({error:'Sign in again to manage email security.'},401);
  const status=await emailStatus(env,user,jwt);
  if(!status.active)return securityJSON({error:'Sign in required.'},401);
  if(action==='status')return securityJSON({...status,email:String(user.email||'').replace(/^(.).+(@.*)$/,'$1•••$2')});
  if(!passwordSession(jwt))return securityJSON({error:'Sign in with your password before using an email security code.'},403);
  if(user.factors?.some(f=>f.status==='verified')&&jwt.aal!=='aal2')return securityJSON({error:'Verify your authenticator first.',code:'SEVEN_MFA_REQUIRED'},403);
  const body=await boundedJSON(request),base={p_user:user.id,p_session:jwt.session_id};
  if(!['send','verify'].includes(action))return securityJSON({error:'Unknown email security action.'},404);
  const limited=await throttle(request,env,'email-'+action,{identity:user.id,limit:action==='send'?5:8,seconds:600,ipLimit:action==='send'?20:40});if(limited)return limited;
  if(action==='send'){
   const purpose=body.purpose;
   if(!['enable','signin','disable'].includes(purpose))return securityJSON({error:'Choose a security action.'},400);
   if(purpose!=='signin'){
    if(request.headers.get('X-Seven-Profile')!==mainProfile(user))return securityJSON({error:'Use the main profile to change account security.'},403);
    if(status.required)return securityJSON({error:'Verify this sign-in first.',code:'SEVEN_EMAIL_REQUIRED'},403);
    if(typeof body.password!=='string'||!body.password||body.password.length>1024)return securityJSON({error:'Confirm your account password.'},400);
    const proof=await authUpstream(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password:body.password}});
    await cleanupVerification(env,proof.data);
    if(proof.status!==200||proof.data.user?.id!==user.id)return securityJSON({error:'That password is not correct.'},403);
   }
   const challenge=await emailRPC(env,'start',{...base,p_purpose:purpose});
   if(challenge.cooldown)return securityJSON({error:'Wait a minute before requesting another code.',retryAfter:60},429,{'Retry-After':'60'});
   if(!challenge.id)return securityJSON({error:'Email security changed. Close this window and try again.'},409);
   const sent=await authUpstream(env,'/auth/v1/otp',{method:'POST',body:{email:user.email,create_user:false}});
   if(sent.status>=400){await emailRPC(env,'cancel',{...base,p_challenge:challenge.id});return securityJSON({error:sent.status===429?'Please wait before requesting another code.':'Could not send the code. Please try again.'},sent.status===429?429:503);}
   return securityJSON({id:challenge.id,expiresIn:600,email:String(user.email||'').replace(/^(.).+(@.*)$/,'$1•••$2')});
  }
  if(!UUID.test(body.id||'')||!/^\d{6}$/.test(body.code||''))return securityJSON({error:'Enter the six-digit code from your email.'},400);
  const attempt=await emailRPC(env,'attempt',{...base,p_challenge:body.id});
  if(!attempt.valid)return securityJSON({error:'This code request expired or has been used. Request a new code.'},400);
  if(attempt.purpose!=='signin'&&request.headers.get('X-Seven-Profile')!==mainProfile(user))return securityJSON({error:'Use the main profile to change account security.'},403);
  const verification=await authUpstream(env,'/auth/v1/verify',{method:'POST',body:{email:user.email,token:body.code,type:'email'}});
  const verifiedUser=verification.data.user||verification.data.session?.user;
  const valid=verification.status===200&&verifiedUser?.id===user.id&&String(verifiedUser.email).toLowerCase()===String(user.email).toLowerCase()&&!!verifiedUser.email_confirmed_at;
  // OTP creates an AAL1 session. Never return it, persist it or treat it as native MFA.
  await cleanupVerification(env,verification.data);
  if(!valid)return securityJSON({error:'That code did not work. Check your email or request a new code.'},400);
  const result=await emailRPC(env,'finish',{...base,p_challenge:body.id});
  if(!result.valid)return securityJSON({error:'This request changed or expired. Please try again.'},409);
  return securityJSON({ok:true,enabled:result.enabled});
 }catch(error){return securityJSON({error:[400,413].includes(error.status)?error.message:'Email security is temporarily unavailable. Please try again.'},[400,413].includes(error.status)?error.status:503);}
}
