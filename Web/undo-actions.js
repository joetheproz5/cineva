/* Short-lived, profile-scoped undo. Nothing is stored across app launches. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root.document)root.SEVENUndo=api.browser(root);})(typeof window==='undefined'?globalThis:window,function(){
  function create({scope,now=Date.now,schedule=setTimeout,cancel=clearTimeout,changed=()=>{},lifetime=8000}){
    let owner=scope(),epoch=0,sequence=0,timer=null,stack=[],busy=false,paused=false,pauseAt=0;const versions=new Map();
    function sync(){if(scope()!==owner){owner=scope();epoch++;versions.clear();stack=[];busy=false;paused=false;}stack=stack.filter(entry=>(busy||paused||entry.expires>now())&&entry.ticket.isCurrent());}
    function notify(){cancel(timer);sync();if(!stack.length)paused=false;changed();if(stack.length&&!busy&&!paused)timer=schedule(notify,Math.max(1,Math.min(...stack.map(e=>e.expires))-now()));}
    function begin(key){sync();const version=++sequence,context=owner,generation=epoch;versions.set(key,version);stack=stack.filter(e=>e.ticket.key!==key);const ticket={key,scope:context,isCurrent:()=>scope()===context&&epoch===generation&&versions.get(key)===version};notify();return ticket;}
    function offer(ticket,message,undo,valid=()=>true){sync();if(!ticket?.isCurrent())return;stack.push({ticket,message,undo,valid,expires:now()+lifetime});stack=stack.slice(-5);notify();}
    function clear(){epoch++;stack=[];versions.clear();busy=false;paused=false;notify();}
    function current(){sync();return stack.at(-1)||null;}
    function dismiss(){stack.pop();notify();}
    function pause(value){if(value===paused)return;sync();if(value){pauseAt=now();paused=true;}else{const elapsed=now()-pauseAt;stack.forEach(e=>e.expires+=elapsed);paused=false;}notify();}
    async function run(){
      const entry=current();if(!entry||busy)return;const generation=epoch;busy=true;cancel(timer);changed();
      try{
        if(!entry.ticket.isCurrent()||!entry.valid()){stack=stack.filter(e=>e!==entry);return {changed:true};}
        const result=await entry.undo();if(generation!==epoch||!entry.ticket.isCurrent())return;
        stack=stack.filter(e=>e!==entry);return result||{undone:true};
      }catch(error){if(generation===epoch&&entry.ticket.isCurrent()){entry.expires=now()+lifetime;entry.error=error.message||'Could not undo. Try again.';}return {error:true};}
      finally{if(generation===epoch){busy=false;notify();}}
    }
    return {begin,offer,clear,sync:notify,current,dismiss,pause,run,isBusy:()=>busy};
  }
  function browser(root){
    let toast=null,noticeTimer=null;const doc=root.document;
    const scope=()=>typeof state==='undefined'?'boot':JSON.stringify([accountWatchlistUserId()||'guest',activeProfileId(),!!state.session]);
    const translate=text=>typeof t==='function'?t(text):text;
    const manager=create({scope,changed:paint});
    function paint(){
      const entry=manager.current();if(!entry){toast?.remove();toast=null;return;}
      if(!toast){
        toast=doc.createElement('div');toast.className='action-undo';toast.setAttribute('role','region');toast.setAttribute('aria-label',translate('Recent action'));
        toast.innerHTML='<span class="action-undo-copy" role="status" aria-live="polite" aria-atomic="true"></span><button type="button" data-undo-action></button><button type="button" class="action-undo-close" data-undo-dismiss aria-label="Dismiss">×</button>';
        toast.querySelector('[data-undo-action]').onclick=async()=>{const result=await manager.run();if(result?.changed)notice('Newer changes kept.');else if(result?.undone)notice('Undone.');};
        toast.querySelector('[data-undo-dismiss]').onclick=()=>manager.dismiss();
        toast.addEventListener('pointerenter',()=>manager.pause(true));toast.addEventListener('pointerleave',()=>{if(!toast?.contains(doc.activeElement))manager.pause(false);});
        toast.addEventListener('focusin',()=>manager.pause(true));toast.addEventListener('focusout',()=>queueMicrotask(()=>{if(!toast?.contains(doc.activeElement))manager.pause(false);}));
        doc.body.append(toast);
      }
      toast.querySelector('.action-undo-copy').textContent=translate(entry.error||entry.message);toast.querySelector('[data-undo-action]').textContent=translate(manager.isBusy()?'Undoing…':'Undo');
      toast.querySelectorAll('button').forEach(button=>button.disabled=manager.isBusy());toast.setAttribute('aria-busy',String(manager.isBusy()));
    }
    function notice(text){if(manager.current())return;doc.querySelector('.action-undo-notice')?.remove();cancelNotice();const el=doc.createElement('div');el.className='action-undo action-undo-notice';el.setAttribute('role','status');el.textContent=translate(text);doc.body.append(el);noticeTimer=root.setTimeout(()=>el.remove(),1800);}
    function cancelNotice(){root.clearTimeout(noticeTimer);}
    const observer=new root.MutationObserver(()=>{manager.sync();if(typeof state!=='undefined'&&state.undoViewDirty&&!doc.querySelector('.modal')){state.undoViewDirty=false;void root.refreshUndoView?.();}});observer.observe(doc.querySelector('#app'),{childList:true});
    root.addEventListener('storage',()=>manager.sync());
    const begin=key=>{doc.querySelector('.action-undo-notice')?.remove();cancelNotice();return manager.begin(key);};
    return {...manager,begin,clear:()=>{cancelNotice();doc.querySelector('.action-undo-notice')?.remove();manager.clear();}};
  }
  return {create,browser};
});
