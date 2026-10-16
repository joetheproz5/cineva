// Server-only session proof. Email OTP alone never grants access to an email-protected account.
export async function emailRPC(env,action,body={}) {
  const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw Error('Email security is unavailable.');
  const headers={apikey:key,'Content-Type':'application/json'};
  if(!env.SUPABASE_SECRET_KEY)headers.Authorization='Bearer '+key;
  const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/seven_email_security',{
    method:'POST',headers,body:JSON.stringify({p_action:action,...body}),signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Email security is unavailable.');
  return response.json();
}
export function passwordSession(jwt){return Array.isArray(jwt.amr)&&jwt.amr.some(entry=>entry.method==='password');}
export async function emailStatus(env,user,jwt){
  return emailRPC(env,'status',{p_user:user.id,p_session:jwt.session_id||null});
}
