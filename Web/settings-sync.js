/* Durable settings outbox + three-way merge. Credentials never enter the outbox. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SEVENSettingsModel=api;})(typeof window==='undefined'?globalThis:window,function(){
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),unsafe=key=>['__proto__','constructor','prototype'].includes(key);
  function clone(value){if(value===undefined)return undefined;if(Array.isArray(value))return value.map(clone);if(object(value)){const out={};for(const key of Object.keys(value))if(!unsafe(key))out[key]=clone(value[key]);return out;}return value;}
  function equal(a,b){if(a===b)return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));if(object(a)&&object(b)){const keys=Object.keys(a).filter(k=>!unsafe(k)),other=Object.keys(b).filter(k=>!unsafe(k));return keys.length===other.length&&keys.every(k=>equal(a[k],b[k]));}return false;}
  const itemKey=item=>item?.type?item.type+':'+Number(item.id):String(item?.id||'');
  function getPath(document,path){let value=document;for(const key of path){value=Array.isArray(value)?value.find(item=>itemKey(item)===key.slice(1)):value?.[key];}return clone(value);}
  function merge(base,local,remote,{mergeStats}={}){
    const conflicts=[];
    function conflict(path,b,l,r){conflicts.push({path,base:clone(b),local:clone(l),remote:clone(r),localExists:l!==undefined,remoteExists:r!==undefined});return clone(l);}
    function walk(b,l,r,path){
      if(equal(l,b))return clone(r);if(equal(r,b)||equal(l,r))return clone(l);
      const last=path.at(-1);
      if(last==='watchStats'&&mergeStats&&l&&r)return mergeStats(r,l);
      if(last==='used'&&path.includes('screenTime')&&typeof l==='number'&&typeof r==='number'){const parent=path.slice(0,-1),ld=getPath(local,parent)?.date,rd=getPath(remote,parent)?.date;if(ld===rd)return Math.max(l,r);}
      if(['likedAt','hiddenAt'].includes(last)&&Number.isFinite(Date.parse(l))&&Number.isFinite(Date.parse(r)))return Date.parse(l)>Date.parse(r)?l:r;
      if(last==='recentSearches'&&Array.isArray(l)&&Array.isArray(r)){const fold=value=>String(value).toLowerCase(),bs=new Set((b||[]).map(fold)),ls=new Set(l.map(fold)),rs=new Set(r.map(fold)),seen=new Set();return [...l,...r].filter(value=>{const key=fold(value);if(seen.has(key)||bs.has(key)&&(!ls.has(key)||!rs.has(key)))return false;seen.add(key);return true;}).slice(0,12);}
      if(object(l)&&object(r)&&(object(b)||b===undefined)){
        const out={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){if(unsafe(key))continue;const value=walk(b?.[key],l[key],r[key],[...path,key]);if(value!==undefined)out[key]=value;}return out;
      }
      if(['profiles','hiddenTitles','likedTitles','restrictedTitles'].includes(last)&&Array.isArray(l)&&Array.isArray(r)&&(Array.isArray(b)||b===undefined)){
        const toMap=rows=>new Map((rows||[]).map(item=>[itemKey(item),item])),bm=toMap(b),lm=toMap(l),rm=toMap(r),out=[];
        for(const key of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const value=walk(bm.get(key),lm.get(key),rm.get(key),[...path,'@'+key]);if(value!==undefined)out.push(value);}
        if(last==='profiles'&&(out.length<1||out.length>5))return conflict(path,b,l,r);
        return out;
      }
      return conflict(path,b,l,r);
    }
    return {value:walk(base,local,remote,[]),conflicts};
  }
  function setPath(document,path,value,exists=true){const result=clone(document);let cursor=result;for(let i=0;i<path.length;i++){const key=path[i],last=i===path.length-1;if(unsafe(key))throw Error('Invalid setting path.');if(Array.isArray(cursor)){const index=cursor.findIndex(item=>itemKey(item)===key.slice(1));if(last){if(index>=0){if(exists)cursor[index]=clone(value);else cursor.splice(index,1);}else if(exists)cursor.push(clone(value));}else{if(index<0)throw Error('This profile no longer exists.');cursor=cursor[index];}}else if(last){if(exists)cursor[key]=clone(value);else delete cursor[key];}else{if(!object(cursor[key])&&!Array.isArray(cursor[key]))cursor[key]=path[i+1].startsWith('@')?[]:{};cursor=cursor[key];}}return result;}
  function create({owner,storage,read,write,normalize=value=>clone(value),apply=()=>{},status=()=>{},online=()=>true,schedule=setTimeout,cancel=clearTimeout,lock=async fn=>fn(),transport=async fn=>fn(),uuid=()=>String(Date.now())+'-'+Math.random(),mergeStats}){
    const key='seven.settings.sync.'+owner,writer=uuid(),options={mergeStats};let base={},desired={},observed={},revision=0,conflicts=[],dirty=false,initialized=false,stopped=false,running=null,timer=null,attempt=0,lastSerial='',phase='saved',lastError='';
    const state=()=>({phase,queued:dirty,conflicts:clone(conflicts),error:lastError,revision});
    function report(value,error=''){phase=value;lastError=error;status(state());}
    function combine(b,l,r){return merge(b,l,r,options);}
    function rememberConflicts(next){const map=new Map(conflicts.map(c=>[JSON.stringify(c.path),c]));next.forEach(c=>map.set(JSON.stringify(c.path),c));conflicts=[...map.values()];}
    function ingest(record){
      if(!record||record.owner!==owner||record.serial===lastSerial||!object(record.base)||!object(record.desired)||!Number.isSafeInteger(record.revision))return;
      lastSerial=record.serial;
      const incomingPaths=new Set((record.conflicts||[]).map(c=>JSON.stringify(c.path)));
      conflicts=conflicts.filter(conflict=>{if(incomingPaths.has(JSON.stringify(conflict.path)))return true;const incoming=getPath(record.desired,conflict.path);if(equal(incoming,conflict.local)||equal(incoming,conflict.remote)){desired=setPath(desired,conflict.path,incoming,incoming!==undefined);return false;}return true;});
      if(record.revision>revision){const rebased=combine(base,desired,record.base);base=clone(record.base);revision=record.revision;desired=rebased.value;rememberConflicts(rebased.conflicts);}
      const other=combine(record.base,record.desired,base),combined=combine(base,desired,other.value);desired=combined.value;rememberConflicts([...(record.conflicts||[]),...other.conflicts,...combined.conflicts]);dirty=!equal(desired,base)||conflicts.length>0;
    }
    function load(){try{const saved=JSON.parse(storage.getItem('seven.settings.confirmed.'+owner)||'null');if(saved&&Number.isSafeInteger(saved.revision)&&saved.revision>revision&&object(saved.account)){const next=combine(base,desired,normalize(saved.account));base=normalize(saved.account);revision=saved.revision;desired=next.value;rememberConflicts(next.conflicts);}const pending=storage.getItem(key);if(!pending&&lastSerial&&saved?.revision>=revision){desired=clone(base);conflicts=[];dirty=false;lastSerial='';}else ingest(JSON.parse(pending||'null'));}catch{/* Keep the current in-memory outbox if storage is inaccessible. */}}
    function persist(){
      dirty=!equal(base,desired)||conflicts.length>0;
      storage.setItem('seven.settings.confirmed.'+owner,JSON.stringify({account:base,revision}));
      if(!dirty){storage.removeItem(key);lastSerial='';return;}
      lastSerial=uuid();storage.setItem(key,JSON.stringify({owner,base,desired,revision,conflicts,serial:lastSerial,writer}));
    }
    function publish(){const before=observed;apply(clone(desired),clone(before));observed=clone(desired);}
    function retry(){cancel(timer);if(stopped||!dirty||conflicts.length)return;timer=schedule(()=>void flush(),Math.min(60000,2000*2**Math.min(attempt++,5)));}
    function attach(remote,rev,local){base=normalize(remote);desired=normalize(local);observed=clone(desired);revision=Number.isSafeInteger(rev)?rev:0;initialized=true;load();publish();if(dirty){report(conflicts.length?'conflict':'waiting');retry();}else report('saved');}
    async function enqueue(snapshot,baseline){
      if(stopped||!initialized)return false;
      return lock(()=>{if(stopped)return false;load();const next=combine(baseline?normalize(baseline):observed,normalize(snapshot),desired);desired=next.value;rememberConflicts(next.conflicts);conflicts=conflicts.map(c=>({...c,local:getPath(desired,c.path),localExists:getPath(desired,c.path)!==undefined}));observed=normalize(snapshot);dirty=!equal(base,desired)||conflicts.length>0;persist();publish();report(conflicts.length?'conflict':dirty?'waiting':'saved');return true;});
    }
    async function reconcile(remote,rev){if(rev<revision)return;const next=combine(base,desired,normalize(remote));base=normalize(remote);revision=rev;desired=next.value;rememberConflicts(next.conflicts);persist();publish();}
    async function flush({strict=false}={}){
      if(running){const result=await running;if(result.saved&&dirty&&!conflicts.length&&!stopped)return flush({strict});if(strict&&!result.saved)throw Error(result.error||'Saved on this device. Waiting to sync.');return result;}
      if(stopped)return {saved:false};
      running=transport(async()=>{
        cancel(timer);await lock(()=>load());
        if(conflicts.length){report('conflict');return {saved:false,conflict:true};}
        if(!dirty){report('saved');return {saved:true};}
        if(!online()){report('waiting');retry();return {saved:false,queued:true};}
        report('saving');
        try{
          for(let tries=0;tries<4;tries++){
            let sent,expected;await lock(()=>{load();sent=clone(desired);expected=revision;});
            if(conflicts.length){report('conflict');return {saved:false,conflict:true};}
            let response;
            try{response=await write(sent,expected);}catch(error){if(error.status!==409||!error.account||!Number.isSafeInteger(error.revision))throw error;response={conflict:true,account:error.account,revision:error.revision};}
            if(stopped)return {saved:false,queued:true};
            if(!response||!object(response.account)||!Number.isSafeInteger(response.revision))throw Error('Could not confirm the settings save.');
            await lock(()=>{load();if(response.revision<revision)return;if(response.conflict)return reconcile(response.account,response.revision);const next=combine(sent,desired,normalize(response.account));base=normalize(response.account);revision=response.revision;desired=next.value;rememberConflicts(next.conflicts);persist();publish();});
            if(conflicts.length){report('conflict');return {saved:false,conflict:true};}
            if(!dirty){attempt=0;report('saved');return {saved:true};}
          }
          report('waiting');retry();return {saved:false,queued:true};
        }catch(error){const permanent=[400,413,422].includes(error.status);report([401,403].includes(error.status)?'signin':permanent?'error':'waiting',error.message);if(!permanent&&![401,403].includes(error.status))retry();return {saved:false,queued:true,error:error.message};}
      }).finally(()=>{running=null;});
      const result=await running;if(strict&&!result.saved)throw Error(result.conflict?'Review conflicting settings before continuing.':result.error||'Saved on this device. Waiting to sync.');return result;
    }
    async function save(snapshot,options={}){if(!await enqueue(snapshot,options.base))return {saved:false};return flush(options);}
    async function refresh(){if(stopped)return;try{const remote=await read();if(stopped)return;if(!remote||!object(remote.account)||!Number.isSafeInteger(remote.revision))throw Error('Could not confirm the latest settings.');await lock(()=>{load();return reconcile(remote.account,remote.revision);});report(conflicts.length?'conflict':dirty?'waiting':'saved');if(dirty&&!conflicts.length)void flush();}catch(error){if(dirty){report([401,403].includes(error.status)?'signin':'waiting',error.message);retry();}}}
    async function resolve(path,choice){await lock(()=>{load();const conflict=conflicts.find(c=>equal(c.path,path));if(!conflict)return;desired=setPath(desired,path,choice==='remote'?conflict.remote:conflict.local,choice==='remote'?conflict.remoteExists:conflict.localExists);conflicts=conflicts.filter(c=>!equal(c.path,path));persist();publish();});return flush();}
    function stop(){stopped=true;cancel(timer);}
    return {attach,save,enqueue,flush,refresh,resolve,stop,state,ingestStored:async()=>{await lock(()=>{load();publish();});report(conflicts.length?'conflict':dirty?'waiting':'saved');},snapshot:()=>clone(desired)};
  }
  return {clone,equal,merge,setPath,create};
});
