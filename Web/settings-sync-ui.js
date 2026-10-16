(function(root){
  let engine=null,accountOwner=null,generation=0,lastPhase='',lastRefresh=0,view={phase:'local',conflicts:[]};
  let translated=false;
  function translations(){if(translated||typeof UI_STRINGS==='undefined')return;translated=true;Object.assign(UI_STRINGS.French,{'Saved':'Enregistré','Saving…':'Enregistrement…','Waiting to sync':'En attente de synchronisation','Review changes':'Vérifier les modifications','Sign in to sync':'Connectez-vous pour synchroniser','Couldn’t sync':'Synchronisation impossible','Saved on this device':'Enregistré sur cet appareil','Retry now':'Réessayer','Review':'Vérifier','Keep this device':'Garder cet appareil','Use other device':'Utiliser l’autre appareil','The same setting changed on another device. Choose which one to keep.':'Ce réglage a changé sur un autre appareil. Choisissez la valeur à conserver.','Saved on this device. Waiting to sync.':'Enregistré sur cet appareil. En attente de synchronisation.'});Object.assign(UI_STRINGS.Arabic,{'Saved':'تم الحفظ','Saving…':'جارٍ الحفظ…','Waiting to sync':'بانتظار المزامنة','Review changes':'مراجعة التغييرات','Sign in to sync':'سجّل الدخول للمزامنة','Couldn’t sync':'تعذّرت المزامنة','Saved on this device':'محفوظ على هذا الجهاز','Retry now':'إعادة المحاولة','Review':'مراجعة','Keep this device':'الاحتفاظ بقيمة هذا الجهاز','Use other device':'استخدام قيمة الجهاز الآخر','The same setting changed on another device. Choose which one to keep.':'تغيّر هذا الإعداد على جهاز آخر. اختر القيمة التي تريد الاحتفاظ بها.','Saved on this device. Waiting to sync.':'محفوظ على هذا الجهاز. بانتظار المزامنة.'});}
  const model=()=>root.SEVENSettingsModel,owner=()=>state.session?.access_token&&!state.user?.is_anonymous?(state.session.user?.id||state.user?.id||null):null;
  const normalize=value=>{const fallback=defaultAccount(),saved=model().clone(value||{}),out={...fallback,...saved,preferences:{...fallback.preferences,...saved.preferences},profiles:saved.profiles?.length?saved.profiles:fallback.profiles};const scrub=value=>{if(value&&typeof value==='object')for(const key of Object.keys(value)){if(/^(password|currentPassword|confirmPassword|pin|currentPin|parentPin|confirmPin|access_token|refresh_token)$/i.test(key))delete value[key];else scrub(value[key]);}};scrub(out);delete out.activeProfileId;if(out.parentAccessEnabled)delete out.parentPinHash;out.profiles=out.profiles.map(profile=>({...profile,preferences:{...profile.preferences,maturity:maturityForProfile(profile)}}));return out;};
  const snapshot=()=>normalize(state.account);
  function apply(next,before){
    if(owner()!==accountOwner)return;
    const active=state.account.activeProfileId,old=state.account,merged=model().merge(before,snapshot(),next,{mergeStats:root.SEVENProfileStats?.mergeWatchStats}).value;
    state.account={...merged,activeProfileId:active};
    if(state.profileDraft){const id=state.profileDraft.id,remote=merged.profiles.find(p=>p.id===id),prior=old.profiles.find(p=>p.id===id);if(remote)state.profileDraft=model().merge(prior,state.profileDraft,remote).value;}
    persistLocalAccount();
    if(!state.account.profiles.some(p=>p.id===active)){state.account.activeProfileId=state.account.profiles[0]?.id;state.profileDraft=null;state.route='profiles';hydrateWatchlist();render();showToast('This profile was removed on another device.');}
    if(state.user?.id===accountOwner)state.user={...state.user,user_metadata:{...state.user.user_metadata,seven_account:model().clone(next),seven_settings_revision:engine?.state().revision||0}};
  }
  function lock(name,task){return navigator.locks?.request?navigator.locks.request(name,{mode:'exclusive'},task):Promise.resolve().then(task);}
  function ensure(){
    translations();
    const id=owner();if(id===accountOwner&&engine)return engine;
    engine?.stop();engine=null;accountOwner=id;generation++;view={phase:id?'saved':'local',conflicts:[]};
    if(!id)return null;
    const context=generation,guard=()=>{if(owner()!==id||generation!==context)throw Error('Account changed.');};
    async function request(options){guard();if(accessTokenExpiresSoon()&&sessionCanRefresh())try{await refreshSession();}catch{}guard();const send=()=>localAPI('/api/account/settings',{...options,signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',...authorizedHeaders()}});let result;try{result=await send();}catch(error){if(error.status!==401||error.code==='SEVEN_SESSION_REVOKED'||!sessionCanRefresh())throw error;guard();await refreshSession();guard();result=await send();}guard();return result;}
    engine=model().create({owner:id,storage:localStorage,uuid:()=>crypto.randomUUID(),normalize,mergeStats:root.SEVENProfileStats?.mergeWatchStats,online:()=>navigator.onLine,
      lock:task=>lock('seven-settings-queue:'+id,task),transport:task=>lock('seven-settings-send:'+id,task),
      read:()=>request({method:'GET'}),write:(account,revision)=>request({method:'PUT',body:JSON.stringify({protocol:1,account,revision})}),
      apply:(next,before)=>{if(generation===context)apply(next,before);},status:status=>{if(generation!==context)return;view=status;paint();}
    });
    const remote=state.user?.user_metadata?.seven_account||state.account,revision=Number(state.user?.user_metadata?.seven_settings_revision)||0;
    engine.attach(remote,revision,state.account);
    // Interrupted saves are kept separately until their short queue lock is acquired.
    const backups=Object.keys(localStorage).filter(key=>key.startsWith('seven.settings.pending.'+id+'.')).map(key=>{try{return {key,data:JSON.parse(localStorage.getItem(key)||'null')};}catch{return {key,data:null};}}).filter(item=>item.data?.account&&item.data?.owner===id).sort((a,b)=>a.data.time-b.data.time);
    if(backups.length)void(async()=>{for(const item of backups){if(generation!==context)return;const recovered=item.data.before?model().merge(item.data.before,item.data.account,engine.snapshot(),{mergeStats:root.SEVENProfileStats?.mergeWatchStats}).value:item.data.account;if(await engine.enqueue(recovered))localStorage.removeItem(item.key);}if(generation===context)await engine.flush();})();
    return engine;
  }
  async function save(account=state.account,{strict=false,base}={}){
    const current=ensure(),id=accountOwner,context=generation;if(!current){persistLocalAccount();return {saved:false,local:true};}
    const safe=normalize(account),backup='seven.settings.pending.'+id+'.'+crypto.randomUUID();
    view={...view,phase:navigator.onLine?'saving':'waiting'};paint();
    try{localStorage.setItem(backup,JSON.stringify({owner:id,time:Date.now(),before:base?normalize(base):current.snapshot(),account:safe}));if(await current.enqueue(safe,base))localStorage.removeItem(backup);}catch(error){view={...view,phase:'error',error:'Could not safely store these changes. Free device storage and try again.'};paint();throw error;}
    if(generation!==context)return {saved:false};const result=await current.flush({strict});if(!result.saved&&!document.querySelector('.profile-settings-redesign'))notice(result.conflict?'Settings changed on another device. Review them in Settings.':'Saved on this device. Waiting to sync.');return result;
  }
  function labels(){return {saved:'Saved',saving:'Saving…',waiting:'Waiting to sync',conflict:'Review changes',signin:'Sign in to sync',error:'Couldn’t sync',local:'Saved on this device'};}
  function paint(){
    const page=document.querySelector('.profile-settings-redesign');
    if(page&&!page.querySelector('[data-settings-sync-status]')){const bar=document.createElement('div');bar.className='settings-sync-bar';bar.innerHTML='<span data-settings-sync-status role="status" aria-live="polite"></span><button type="button" data-settings-sync-action hidden></button>';page.querySelector('.profile-settings-topbar')?.after(bar);bar.querySelector('button').onclick=()=>view.phase==='conflict'?review():view.phase==='signin'?showAuth('login'):void ensure()?.flush();}
    const text=document.querySelector('[data-settings-sync-status]'),button=document.querySelector('[data-settings-sync-action]');if(text){text.textContent=t(labels()[view.phase]||'Waiting to sync');text.title=view.error||'';}if(button){button.hidden=!['waiting','conflict','signin','error'].includes(view.phase);button.textContent=t(view.phase==='conflict'?'Review':view.phase==='signin'?'Sign in':'Retry now');}
    if(view.phase!==lastPhase){if(view.phase==='saved')document.querySelector('.settings-sync-notice')?.remove();if(['waiting','conflict','signin','error'].includes(view.phase)&&lastPhase==='saving'&&!page)notice(view.phase==='conflict'?'Settings changed on another device. Review them in Settings.':'Saved on this device. Waiting to sync.');lastPhase=view.phase;}
  }
  function notice(message){document.querySelector('.settings-sync-notice')?.remove();const el=document.createElement('div');el.className='settings-sync-notice';el.setAttribute('role','status');el.textContent=t(message);document.body.append(el);setTimeout(()=>el.remove(),4500);}
  function settingName(path){const names={name:'Profile name',language:'Display language',playerProvider:'Player',maturity:'Maturity rating',kids:'Kids profile',profiles:'Profiles',favoriteGenres:'Favourite genres',pinHash:'Profile PIN',familySafe:'Family-safe filtering',blockScary:'Scary titles',screenTime:'Screen time',minutes:'Daily limit',autoplayNext:'Autoplay',avatar:'Profile picture',likedTitles:'Ratings',hiddenTitles:'Hidden titles',restrictedTitles:'Blocked titles'};return path.filter(part=>!['preferences'].includes(part)).map(part=>part.startsWith('@')?state.account.profiles.find(p=>p.id===part.slice(1))?.name||'Title':names[part]||part).join(' · ');}
  function display(value,path){if(path.some(p=>/pin|hash|code/i.test(p)))return 'Changed';if(path.at(-1)==='avatar')return 'Profile picture';if(value===undefined)return 'Removed';if(typeof value==='boolean')return value?'On':'Off';if(Array.isArray(value))return value.map(v=>typeof v==='object'?v.name||v.title||'Profile':String(v)).join(', ')||'None';if(value&&typeof value==='object')return value.name||value.title||'Changed';return String(value).slice(0,160);}
  function review(){
    document.querySelector('.settings-sync-review')?.remove();if(!view.conflicts.length)return;
    const modal=document.createElement('div');modal.className='modal settings-sync-review';modal.innerHTML='<section role="dialog" aria-modal="true" aria-label="Review settings changes"><button type="button" data-close aria-label="Close">×</button><h2>Review changes</h2><p>The same setting changed on another device. Choose which one to keep.</p><div data-conflicts></div><p data-sync-error role="status"></p></section>';document.querySelector('#app').append(modal);
    modal.querySelector('h2').textContent=t('Review changes');modal.querySelector('p').textContent=t('The same setting changed on another device. Choose which one to keep.');
    const focus=document.activeElement,close=()=>{modal.remove();if(focus?.isConnected&&focus.getClientRects().length)focus.focus();};modal.querySelector('[data-close]').onclick=close;modal.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}}};
    for(const conflict of view.conflicts){const row=document.createElement('article');const heading=document.createElement('h3');heading.textContent=settingName(conflict.path);row.append(heading);for(const [choice,label,value,exists]of [['local','Keep this device',conflict.local,conflict.localExists],['remote','Use other device',conflict.remote,conflict.remoteExists]]){const button=document.createElement('button');button.type='button';button.dataset.settingsChoice=choice;const caption=document.createElement('b'),description=document.createElement('span');caption.textContent=t(label);description.textContent=display(exists?value:undefined,conflict.path);button.append(caption,description);button.onclick=async()=>{row.querySelectorAll('button').forEach(b=>b.disabled=true);try{await ensure().resolve(conflict.path,choice);if(!modal.isConnected)return;if(!view.conflicts.length)close();else review();}catch(error){modal.querySelector('[data-sync-error]').textContent=error.message;row.querySelectorAll('button').forEach(b=>b.disabled=false);}};row.append(button);}modal.querySelector('[data-conflicts]').append(row);}
    modal.querySelector('[data-close]').focus();
  }
  async function refresh({force=false}={}){const current=ensure();if(!current||!force&&Date.now()-lastRefresh<15000)return;lastRefresh=Date.now();await current.refresh();}
  function stop(){lastRefresh=0;generation++;engine?.stop();engine=null;accountOwner=null;view={phase:'local',conflicts:[]};}
  root.SEVENSettingsSync={save,attach:()=>{stop();ensure();paint();},refresh,review,stop,state:()=>view};
  new MutationObserver(()=>{if(typeof state!=='undefined'){ensure();paint();}}).observe(document.querySelector('#app'),{childList:true});
  root.addEventListener('online',()=>{lastRefresh=0;void refresh();});root.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});root.addEventListener('storage',event=>{if(event.key==='seven.settings.sync.'+accountOwner)void engine?.ingestStored();});
  setInterval(()=>{if(!document.hidden&&owner())void refresh();},60000);
})(window);
