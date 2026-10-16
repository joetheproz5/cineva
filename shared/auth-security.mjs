import policy from '../Web/password-policy.js';

const encoder=new TextEncoder();
export const securityJSON=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function sameOrigin(request){const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');return (!origin||origin===new URL(request.url).origin)&&site!=='cross-site';}
export async function boundedJSON(request,limit=8192){
  const reader=request.body?.getReader(),chunks=[];let size=0;
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});const error=Error('Request is too large.');error.status=413;throw error;}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}catch{const error=Error('Invalid JSON.');error.status=400;throw error;}
  if(!body||typeof body!=='object'||Array.isArray(body)){const error=Error('Invalid request.');error.status=400;throw error;}return body;
}
const keyOf=env=>env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
export async function throttle(request,env,action,{identity='',limit=12,seconds=900,ipLimit=40}={}){
  const key=keyOf(env),secret=env.SEVEN_DASHBOARD_SECRET;
  if(!key||!secret)return securityJSON({error:'Sign-in protection is temporarily unavailable. Please try again.'},503);
  // CF-Connecting-IP is set by Cloudflare, never trust arbitrary X-Forwarded-For.
  const ip=request.headers.get('CF-Connecting-IP')||'local',signer=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  async function hash(value){const result=await crypto.subtle.sign('HMAC',signer,encoder.encode('seven-auth-rate-v1:'+value));return [...new Uint8Array(result)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  const buckets=[{key:await hash(action+':ip:'+ip),limit:ipLimit,seconds}];
  if(identity)buckets.push({key:await hash(action+':actor:'+ip+':'+String(identity).trim().toLowerCase()),limit,seconds});
  const headers={apikey:key,'Content-Type':'application/json'};if(!env.SUPABASE_SECRET_KEY)headers.Authorization='Bearer '+key;
  try{const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/seven_auth_rate_limit',{method:'POST',headers,body:JSON.stringify({p_buckets:buckets}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const result=await response.json();if(typeof result.allowed!=='boolean')throw Error();if(!result.allowed)return securityJSON({error:'Too many attempts. Please wait before trying again.',code:'SEVEN_RATE_LIMITED',retryAfter:result.retry_after},429,{'Retry-After':String(result.retry_after||60)});return null;}catch{return securityJSON({error:'Sign-in protection is temporarily unavailable. Please try again.'},503);}
}
export async function passwordSafety(password){
  const invalid=policy.error(password);if(invalid)return securityJSON({error:invalid,code:'SEVEN_WEAK_PASSWORD'},400);
  // Only the first 5 SHA-1 hex characters leave the server. Never send the password/hash in full.
  const digest=await crypto.subtle.digest('SHA-1',encoder.encode(password)),hex=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  try{const response=await fetch('https://api.pwnedpasswords.com/range/'+hex.slice(0,5),{headers:{'Add-Padding':'true','User-Agent':'SEVEN password safety'},signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const text=await response.text();if(!/^[A-F0-9]{35}:\d+/m.test(text))throw Error();if(text.split(/\r?\n/).some(row=>{const [suffix,count]=row.split(':');return suffix===hex.slice(5)&&Number(count)>0;}))return securityJSON({error:'This password has appeared in a data breach. Choose a different, unique password.',code:'SEVEN_BREACHED_PASSWORD'},400);return null;}catch{return securityJSON({error:'The password safety check is temporarily unavailable. Please try again.'},503);}
}
