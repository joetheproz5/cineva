// Batched upserts are one PostgREST transaction. Undo uses compare-and-swap
// filters so progress recorded after the batch is never overwritten.
const fields = ['content_key','content_type','tmdb_id','season','episode','title','poster_path','progress_seconds','duration_seconds','is_watched','last_watched_at'];
const validKey=(key,profile)=>typeof key==='string'&&key.startsWith(`seven-progress-${profile}-`)&&/^(?:movie-\d+-0-0|tv-\d+-\d+-\d+)$/.test(key.slice(`seven-progress-${profile}-`.length));
function record(value, profile) {
  if (!value || typeof value !== 'object') throw Error('Invalid progress record.');
  const type=value.content_type,id=Number(value.tmdb_id),season=Number(value.season),episode=Number(value.episode);
  const key=`seven-progress-${profile}-${type}-${id}-${type==='tv'?season:0}-${type==='tv'?episode:0}`;
  if (!['tv','movie'].includes(type)||!Number.isSafeInteger(id)||id<1||value.content_key!==key||
      (type==='tv'&&(!Number.isSafeInteger(season)||season<0||!Number.isSafeInteger(episode)||episode<1))||
      typeof value.title!=='string'||!value.title.trim()||value.title.length>500||
      ![value.progress_seconds,value.duration_seconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e7)||
      typeof value.is_watched!=='boolean'||typeof value.last_watched_at!=='string'||!Number.isFinite(Date.parse(value.last_watched_at))||
      (value.poster_path!==null&&(typeof value.poster_path!=='string'||value.poster_path.length>500))) throw Error('Invalid progress record.');
  return Object.fromEntries(fields.map(field=>[field,value[field]??null]));
}
export async function handleProgressBatch(request,env) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return reply({error:'Supabase is not configured.'},503);
  const token=request.headers.get('Authorization');if(!token?.startsWith('Bearer '))return reply({error:'Sign in required.'},401);
  const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:token,'Content-Type':'application/json'};
  let body,entries;
  try {
    const text=await request.text();if(text.length>750000)throw Error('This batch is too large.');body=JSON.parse(text);
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(body.profile||''))throw Error('Invalid profile.');
    if(body.action==='read') {
      if(!Array.isArray(body.keys)||!body.keys.length||body.keys.length>1000||!body.keys.every(key=>validKey(key,body.profile)))throw Error('Invalid progress keys.');
      entries=body.keys.map(key=>({key}));
    } else if(body.action==='undo') {
      if(!Array.isArray(body.entries)||!body.entries.length||body.entries.length>20)throw Error('Undo supports 20 records per request.');
      entries=body.entries.map(item=>{
        if(!validKey(item.key,body.profile)||
           typeof item.expected!=='string'||!Number.isFinite(Date.parse(item.expected)))throw Error('Invalid undo record.');
        const previous=item.previous===null?null:record(item.previous,body.profile);
        if(previous&&previous.content_key!==item.key)throw Error('Undo key mismatch.');return {...item,previous};
      });
    } else {
      if(body.action!==undefined||!Array.isArray(body.records)||!body.records.length||body.records.length>1000)throw Error('Save up to 1,000 records at a time.');
      entries=body.records.map(item=>record(item,body.profile));
    }
    const keys=entries.map(item=>item.content_key||item.key);if(new Set(keys).size!==keys.length)throw Error('Duplicate progress records.');
  } catch(error) {return reply({error:error.message||'Invalid batch.'},400);}
  try {
    const auth=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers});
    if(!auth.ok)return reply({error:'Sign in required.'},401);
    const user=await auth.json();if(user.is_anonymous===true)return reply({error:'An account is required.'},403);
    const base=`${env.SUPABASE_URL}/rest/v1/playback_progress`;
    if(body.action==='read') {
      const rows=[];
      for(let start=0;start<entries.length;start+=80){
        const keys=entries.slice(start,start+80).map(item=>item.key).join(',');
        const response=await fetch(`${base}?select=*&content_key=in.(${encodeURIComponent(keys)})`,{headers});
        const data=await response.json();if(!response.ok)return reply(data,response.status);rows.push(...data);
      }return reply(rows);
    }
    if(body.action!=='undo') {
      const response=await fetch(`${base}?on_conflict=user_id,content_key`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(entries)});
      const data=await response.json();return reply(data,response.status);
    }
    const results=[];let next=0;
    await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
      while(next<entries.length) {
        const item=entries[next++];
        try {
          const query=`content_key=eq.${encodeURIComponent(item.key)}&last_watched_at=eq.${encodeURIComponent(item.expected)}`;
          const response=await fetch(`${base}?${query}`,{method:item.previous?'PATCH':'DELETE',headers:{...headers,Prefer:'return=representation'},...(item.previous?{body:JSON.stringify(item.previous)}:{})});
          const rows=await response.json();
          results.push({key:item.key,status:response.ok?(Array.isArray(rows)&&rows.length?'restored':'changed'):'failed'});
        }catch{results.push({key:item.key,status:'failed'});}
      }
    }));return reply({results});
  } catch {return reply({error:'Progress sync is unavailable. Try again.'},502);}
}
