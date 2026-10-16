/* Public US classifications only. Never infer a child's age allowance from genres. */
(function(root,factory){
  const model=factory();
  if(typeof module==="object"&&module.exports)module.exports=model;
  if(root.document){
    const store=model.createStore(async(type,id)=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{
        // A schema key prevents old/offline API responses without ratings from being reused.
        const response=await root.fetch(`/api/tmdb/${type}/${id}/${type==="movie"?"release_dates":"content_ratings"}?age_schema=1`,{signal:controller.signal});
        if(!response.ok)throw Error("Age classification unavailable");
        return await response.json();
      }finally{clearTimeout(timer);}
    },{onIdle:()=>root.dispatchEvent(new Event("seven-age-ratings-ready"))});
    root.SEVENAge={...model,...store};
  }
})(typeof window==="undefined"?globalThis:window,function(){
  const COUNTRY="US",LIMITS={Kids:1,"13+":2,"16+":3};
  // Bands, not invented legal ages: PG/TV-PG require parental guidance.
  const MOVIE={G:0,PG:1,"PG-13":2,R:4,"NC-17":5};
  const TV={"TV-Y":0,"TV-Y7":0,"TV-Y7-FV":0,"TV-G":0,"TV-PG":1,"TV-14":3,"TV-MA":4};
  const typeOf=item=>item?.media_type==="person"?null:["movie","tv"].includes(item?.type)?item.type:["movie","tv"].includes(item?.media_type)?item.media_type:item?.title||item?.original_title?"movie":item?.name||item?.original_name?"tv":null;
  const keyOf=item=>{const type=typeOf(item),id=Number(item?.id);return type&&Number.isSafeInteger(id)&&id>0?`${type}:${id}`:"";};
  function canonical(value){return String(value||"").trim().toUpperCase().replace(/[\s\u2010-\u2015_]+/g,"-");}
  function classification(type,payload){
    const entries=Array.isArray(payload?.results)?payload.results.filter(row=>row?.iso_3166_1===COUNTRY):[];
    const values=type==="movie"?entries.flatMap(row=>Array.isArray(row.release_dates)?row.release_dates.map(release=>release?.certification):[]):entries.map(row=>row.rating);
    const codes=[...new Set(values.map(canonical).filter(Boolean))],bands=type==="movie"?MOVIE:TV;
    if(!codes.length||codes.some(code=>!Object.hasOwn(bands,code)))return {status:"unrated",country:COUNTRY,code:"",band:null};
    // Re-releases and TV variants can disagree. Use the strictest listed US classification.
    const code=codes.sort((a,b)=>bands[b]-bands[a])[0];
    return {status:"rated",country:COUNTRY,code,band:bands[code]};
  }
  function permits(record,limit,adult=false){return limit==="18+"||!adult&&record?.status==="rated"&&Object.hasOwn(LIMITS,limit)&&record.band<=LIMITS[limit];}
  function collect(payload,path){
    const found=new Map(),fallback=/^(movie|tv)\//.exec(path)?.[1]||/^discover\/(movie|tv)$/.exec(path)?.[1]||/^search\/(movie|tv)$/.exec(path)?.[1]||(/^collection\//.test(path)?"movie":null);
    const add=(item,type)=>{if(!item||item.media_type==="person")return;const value={...item,type:typeOf(item)||type},key=keyOf(value);if(key)found.set(key,value);};
    if(/^(movie|tv)\/\d+$/.test(path))add(payload,fallback);
    for(const array of [payload?.results,payload?.parts,payload?.cast,payload?.crew,payload?.combined_credits?.cast,payload?.combined_credits?.crew])if(Array.isArray(array))array.forEach(item=>add(item,fallback));
    return [...found.values()];
  }
  function createStore(fetchRatings,{now=Date.now,ttl=24*60*60*1000,unratedTtl=60*60*1000,errorTtl=30000,limit=2000,concurrency=6,onIdle=()=>{}}={}){
    const records=new Map(),pending=new Map(),queue=[];let running=0,failures=0,unavailableUntil=0;
    function get(item){const key=keyOf(item),entry=records.get(key);if(!entry)return null;if(entry.expires<=now()){records.delete(key);return null;}records.delete(key);records.set(key,entry);return entry.record;}
    function put(item,record){const key=keyOf(item);if(!key)return record;records.delete(key);records.set(key,{record,expires:now()+(record.status==="rated"?ttl:record.status==="error"?errorTtl:unratedTtl)});while(records.size>limit)records.delete(records.keys().next().value);return record;}
    function remember(item){const type=typeOf(item),data=type==="movie"?item?.release_dates:item?.content_ratings;if(data&&Array.isArray(data.results))return put(item,classification(type,data));return get(item);}
    function pump(){
      while(running<concurrency&&queue.length){const task=queue.shift();running++;
        Promise.resolve().then(()=>{if(now()<unavailableUntil)throw Error("Classification service unavailable");return fetchRatings(task.type,task.id);}).then(payload=>{if(!Array.isArray(payload?.results))throw Error("Invalid classification response");failures=0;return classification(task.type,payload);}).catch(()=>{if(++failures>=6)unavailableUntil=now()+errorTtl;return {status:"error",country:COUNTRY,code:"",band:null};}).then(record=>{
          put(task.item,record);pending.delete(task.key);running--;task.resolve(record);pump();if(!running&&!queue.length)onIdle();
        });
      }
    }
    function ensure(item,{force=false}={}){
      const key=keyOf(item);if(!key)return Promise.resolve({status:"unrated",country:COUNTRY,code:"",band:null});
      if(pending.has(key))return pending.get(key);
      if(force){records.delete(key);failures=0;unavailableUntil=0;}const old=get(item);if(old)return Promise.resolve(old);
      const promise=new Promise(resolve=>queue.push({item,key,type:key.split(":")[0],id:Number(item.id),resolve}));pending.set(key,promise);pump();return promise;
    }
    function allowed(item,limit){return permits(get(item),limit,item?.adult===true);}
    async function prepare(payload,path,restricted=false){
      const items=collect(payload,path);items.forEach(remember);
      // Bound large person filmographies/collections; unchecked entries remain hidden, never allowed.
      if(restricted)await Promise.all(items.slice(0,200).map(item=>ensure(item)));
      return payload;
    }
    function label(item){const record=get(item);return record?.status==="rated"?`${record.code} (US)`:"Not rated";}
    return {get,remember,ensure,allowed,prepare,label,pending:()=>pending.size};
  }
  return {COUNTRY,LIMITS,typeOf,keyOf,classification,permits,collect,createStore};
});
