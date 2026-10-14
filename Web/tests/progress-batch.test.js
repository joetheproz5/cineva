const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const modulePromise=import(pathToFileURL(path.resolve(__dirname,'../../shared/progress-batch.mjs')).href);
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-fixture'},stamp='2026-10-14T10:00:00.000Z';
const row=(profile='main',episode=1)=>({content_key:`seven-progress-${profile}-tv-1396-1-${episode}`,content_type:'tv',tmdb_id:1396,season:1,episode,title:'Pilot',poster_path:null,progress_seconds:0,duration_seconds:0,is_watched:true,last_watched_at:stamp});
async function request(body,token='fixture'){return(await modulePromise).handleProgressBatch(new Request('https://seven.test/api/account/progress/batch',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)}),env);}
test('batch saves use one authenticated transactional array, strip owner fields and retain zero watch hours',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(String(url).endsWith('/user')?{id:'fixture',is_anonymous:false}:JSON.parse(options.body));};
 try{const response=await request({profile:'main',records:[{...row(),user_id:'injected'},row('main',2)]});assert.equal(response.status,200);assert.equal(calls.length,2);const payload=JSON.parse(calls[1].options.body);assert.equal(payload.length,2);assert.equal(payload[0].progress_seconds,0);assert.equal(payload[0].user_id,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer fixture');assert.match(calls[1].url,/on_conflict=user_id,content_key/);}finally{global.fetch=original;}
});
test('unauthenticated/anonymous users, cross-profile keys, invalid fields and duplicates are rejected',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({is_anonymous:true});
 try{assert.equal((await request({profile:'main',records:[row()]},'')).status,401);assert.equal((await request({profile:'main',records:[row()]})).status,403);
 for(const records of [[row('other')],[row(),row()],[{...row(),is_watched:'yes'}],[{...row(),duration_seconds:Infinity}],[{...row(),content_key:'seven-progress-main-tv-1396-2-1'}]])assert.equal((await request({profile:'main',records})).status,400);
 assert.equal((await request({profile:'main',action:'read',keys:['seven-progress-other-tv-1396-1-1']})).status,400);
 }finally{global.fetch=original;}
});
test('undo compares the saved timestamp on both restore and delete; newer records return changed',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,options});if(String(url).endsWith('/user'))return Response.json({is_anonymous:false});return Response.json(options.method==='PATCH'?[row()]:[]);};
 try{const response=await request({profile:'main',action:'undo',entries:[{key:row().content_key,expected:stamp,previous:{...row(),progress_seconds:12,is_watched:false}},{key:row('main',2).content_key,expected:stamp,previous:null}]});const data=await response.json();assert.equal(data.results.find(r=>r.key===row().content_key).status,'restored');assert.equal(data.results.find(r=>r.key===row('main',2).content_key).status,'changed');assert.equal(calls[1].options.method,'PATCH');assert.equal(calls[2].options.method,'DELETE');for(const call of calls.slice(1))assert.match(call.url,/last_watched_at=eq\.2026-10-14/);}finally{global.fetch=original;}
});
test('undo reports per-record failures for retry and bounds network subrequests',async()=>{
 const original=global.fetch;global.fetch=async(url)=>String(url).endsWith('/user')?Response.json({is_anonymous:false}):Response.json({error:'Offline'},{status:503});
 try{const result=await(await request({profile:'main',action:'undo',entries:[{key:row().content_key,expected:stamp,previous:null}]})).json();assert.equal(result.results[0].status,'failed');assert.equal((await request({profile:'main',action:'undo',entries:Array.from({length:21},(_,i)=>({key:row('main',i+1).content_key,expected:stamp,previous:null}))})).status,400);}finally{global.fetch=original;}
});
test('movie imports use the canonical zero-season/episode key; read batches are scoped',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push(url);return Response.json(String(url).endsWith('/user')?{is_anonymous:false}:options.method==='POST'?JSON.parse(options.body):[]);};
 try{const movie={...row(),content_key:'seven-progress-main-movie-12-0-0',content_type:'movie',tmdb_id:12,season:null,episode:null};assert.equal((await request({profile:'main',records:[movie]})).status,200);await request({profile:'main',action:'read',keys:[movie.content_key]});assert.match(calls.at(-1),/content_key=in\.\(seven-progress-main-movie-12-0-0\)/);}finally{global.fetch=original;}
});
