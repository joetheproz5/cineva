import {securityJSON,sameOrigin,boundedJSON,throttle} from './auth-security.mjs';
import {authUpstream,sessionReply,cleanupVerification} from './auth-session.mjs';
import {claims,mainProfile} from './devices.mjs';

export async function handleMFA(action,request,env){
  if(!sameOrigin(request))return securityJSON({error:'Request origin rejected.'},403);
  if(request.method!==(action==='status'?'GET':'POST'))return securityJSON({error:'Method not allowed.'},405);
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!token)return securityJSON({error:'Sign in required.'},401);
  try{
    const result=await authUpstream(env,'/auth/v1/user',{token});if(result.status!==200)return securityJSON({error:'Sign in required.'},401);
    const user=result.data,factors=(user.factors||[]).filter(f=>f.factor_type==='totp'),verified=factors.filter(f=>f.status==='verified'),aal=claims(token).aal||'aal1';
    if(action==='status')return securityJSON({enabled:verified.length>0,required:verified.length>0&&aal!=='aal2',factors:verified.map(f=>({id:f.id,name:f.friendly_name||'Authenticator app'}))});
    const limited=await throttle(request,env,'mfa-'+action,{identity:user.id,limit:8,ipLimit:30,seconds:600});if(limited)return limited;
    const body=await boundedJSON(request);
    if(action==='enroll'){
      if(request.headers.get('X-Seven-Profile')!==mainProfile(user))return securityJSON({error:'Use the main profile to change account security.'},403);
      if(verified.length)return securityJSON({error:'Two-step verification is already enabled.'},409);
      if(typeof body.password!=='string'||!body.password||body.password.length>1024)return securityJSON({error:'Confirm your account password.'},400);
      const confirmation=await authUpstream(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password:body.password}});
      await cleanupVerification(env,confirmation.data);
      if(confirmation.status!==200||confirmation.data.user?.id!==user.id)return securityJSON({error:'That password is not correct.'},403);
      // Clear abandoned, unverified enrollments only. Never remove a verified factor here.
      for(const factor of factors.filter(f=>f.status==='unverified'))await authUpstream(env,'/auth/v1/factors/'+encodeURIComponent(factor.id),{token,method:'DELETE'});
      const enrollment=await authUpstream(env,'/auth/v1/factors',{token,method:'POST',body:{factor_type:'totp',friendly_name:'SEVEN authenticator',issuer:'SEVEN'}});
      if(enrollment.status>=400)return securityJSON({error:'Authenticator setup is unavailable. Please try again.'},enrollment.status);
      return securityJSON({id:enrollment.data.id,secret:enrollment.data.totp?.secret,uri:enrollment.data.totp?.uri});
    }
    if(!['verify','disable','cancel'].includes(action))return securityJSON({error:'Unknown security action.'},404);
    const factor=factors.find(f=>f.id===body.factorId);if(!factor)return securityJSON({error:'Choose an authenticator for this account.'},400);
    if(action==='cancel'){
      if(factor.status!=='unverified')return securityJSON({error:'A verified authenticator cannot be cancelled.'},403);
      const cancelled=await authUpstream(env,'/auth/v1/factors/'+encodeURIComponent(factor.id),{token,method:'DELETE'});return securityJSON({ok:cancelled.status<400},cancelled.status);
    }
    if(!/^\d{6}$/.test(body.code||''))return securityJSON({error:'Enter the six-digit code from your authenticator.'},400);
    if(action==='disable'&&(request.headers.get('X-Seven-Profile')!==mainProfile(user)||aal!=='aal2'))return securityJSON({error:'Verify your authenticator from the main profile first.',code:'SEVEN_MFA_REQUIRED'},403);
    const challenge=await authUpstream(env,'/auth/v1/factors/'+encodeURIComponent(factor.id)+'/challenge',{token,method:'POST',body:{}});
    if(challenge.status>=400||!challenge.data.id)return securityJSON({error:'Could not start verification. Please try again.'},challenge.status>=400?challenge.status:502);
    const verification=await authUpstream(env,'/auth/v1/factors/'+encodeURIComponent(factor.id)+'/verify',{token,method:'POST',body:{challenge_id:challenge.data.id,code:body.code}});
    if(verification.status>=400)return securityJSON({error:'That code didn’t work. Try the next code from your authenticator.'},verification.status);
    const session=verification.data.session||verification.data;
    if(action==='disable'){
      const removal=await authUpstream(env,'/auth/v1/factors/'+encodeURIComponent(factor.id),{token:session.access_token,method:'DELETE'});
      if(removal.status>=400)return securityJSON({error:'Could not turn off two-step verification. It is still enabled.'},removal.status);
      const fresh=await authUpstream(env,'/auth/v1/user',{token:session.access_token});session.user=fresh.status===200?fresh.data:session.user;
    }
    return sessionReply(request,env,session);
  }catch(error){return securityJSON({error:[400,413].includes(error.status)?error.message:'Account security is temporarily unavailable. Please try again.'},[400,413].includes(error.status)?error.status:503);}
}
