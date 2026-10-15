(function(root){
  let timer=null,checking=false,version=0,owner='',unlocked=null;
  const sessionScope=()=>`${state.session?.user?.id||state.user?.id||''}:${state.session?.access_token?claims(state.session.access_token).session_id||'':''}`;
  function claims(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return {};}}
  function mainId(){const profiles=state.account?.profiles||[];return (profiles.find(p=>p.id==='main')||profiles[0])?.id||'main';}
  function isMain(profile=currentProfile()){return !!accountWatchlistUserId()&&activeProfileId()===mainId()&&profile?.id===mainId();}
  function deviceName(agent=''){
    const os=/Android/i.test(agent)?'Android':/iPhone|iPad|iPod/i.test(agent)?(/iPad/i.test(agent)?'iPad':'iPhone'):/Windows/i.test(agent)?'Windows':/Macintosh|Mac OS/i.test(agent)?'Mac':/Linux/i.test(agent)?'Linux':'';
    const browser=/Electron|SEVENDesktop/i.test(agent)?'SEVEN desktop':/; wv\)/i.test(agent)?'SEVEN app':/EdgA?\/|EdgiOS\//i.test(agent)?'Edge':/Firefox|FxiOS/i.test(agent)?'Firefox':/Chrome|CriOS/i.test(agent)?'Chrome':/Safari/i.test(agent)?'Safari':'';
    return browser||os?[browser||'Browser',os].filter(Boolean).join(' · '):'Unrecognized browser';
  }
  function activity(value){const time=Date.parse(value);if(!Number.isFinite(time))return 'Activity unavailable';const seconds=Math.max(0,(Date.now()-time)/1000);if(seconds<120)return 'Active recently';if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;if(seconds<86400)return `${Math.floor(seconds/3600)} hr ago`;return new Date(time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
  function headers(){return {...authorizedHeaders(),'X-Seven-Profile':activeProfileId(),...(unlocked?.scope===sessionScope()&&unlocked.until>Date.now()?{'X-Seven-Device-Grant':unlocked.token}:{})};}
  function stop(){clearInterval(timer);timer=null;version++;owner='';unlocked=null;document.querySelector('.devices-modal')?.remove();}
  function rejected(data,requestToken){if(data?.code!=='SEVEN_SESSION_REVOKED'||!state.session)return;if(requestToken&&requestToken!==state.session.access_token){const old=claims(requestToken),current=claims(state.session.access_token);if(!old.session_id||old.session_id!==current.session_id||old.sub!==current.sub)return;}stop();clearSession();resetAppNavigation();state.route='home';render();showToast('This device was signed out. Sign in again to continue.');}
  async function check(){
    if(typeof state==='undefined'||checking||!state.session?.access_token||document.hidden||accessTokenExpiresSoon())return;
    const scope=sessionScope(),request=version;checking=true;
    try{await localAPI('/api/account/devices/status',{headers:authorizedHeaders()});}
    catch(error){if(request===version&&scope===sessionScope()&&error.status===401&&error.code!=='SEVEN_SESSION_REVOKED'&&state.session?.refresh_token){try{await refreshSession();}catch(failure){if([400,401,403].includes(failure.status))rejected({code:'SEVEN_SESSION_REVOKED'});}}}
    finally{checking=false;}
  }
  function start(){const scope=sessionScope();if(!state.session?.access_token)return;if(owner!==scope){clearInterval(timer);version++;owner=scope;unlocked=null;timer=setInterval(()=>void check(),60000);}void check();}
  function logout(){const token=state.session?.access_token;if(!token)return;void fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`},keepalive:true}).catch(()=>{});}
  function bind(scope=document){
    if(!isMain()){unlocked=null;document.querySelector('.devices-modal')?.remove();}
    scope.querySelectorAll('[data-manage-devices]').forEach(button=>button.onclick=()=>void show());
  }
  async function show(){
    if(!isMain())return showToast('Manage devices is available from the main profile.');
    document.querySelector('.devices-modal')?.remove();const scope=sessionScope();let sequence=0,busy=false,devices=[];
    app.insertAdjacentHTML('beforeend','<div class="modal devices-modal"><section class="devices-panel" role="dialog" aria-modal="true" aria-label="Manage devices"><div class="devices-heading"><h2>Manage devices</h2><button type="button" data-devices-close aria-label="Close device management">×</button></div><div class="devices-body"></div><p class="devices-error" role="status" aria-live="polite"></p></section></div>');
    const modal=document.querySelector('.devices-modal'),body=modal.querySelector('.devices-body'),error=modal.querySelector('.devices-error'),alive=()=>modal.isConnected&&scope===sessionScope()&&isMain();
    const close=()=>{if(!busy)modal.remove();};modal.querySelector('[data-devices-close]').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};
    modal.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(c=>c.getClientRects().length);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}}};
    let disabled=[];const waiting=value=>{busy=value;modal.setAttribute('aria-busy',String(value));if(value){disabled=[...modal.querySelectorAll('button,input')].map(control=>({control,was:control.disabled}));disabled.forEach(({control})=>control.disabled=true);}else disabled.forEach(({control,was})=>{if(control.isConnected)control.disabled=was;});};
    function unlock(message=''){
      unlocked=null;error.textContent=message;body.innerHTML='<p class="devices-note">Confirm your account password to view and manage signed-in devices.</p><form data-devices-password-form><label>Account password<input type="password" name="password" required maxlength="1024" autocomplete="current-password"></label><button class="devices-primary" type="submit">Continue</button></form>';
      const form=body.querySelector('form');form.onsubmit=async e=>{e.preventDefault();if(busy||!alive())return;const field=form.elements.password,password=field.value;field.value='';error.textContent='';waiting(true);
        try{const data=await localAPI('/api/account/devices/unlock',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({password})});if(!alive())return;unlocked={scope,token:data.grant,until:Date.now()+Number(data.expiresIn)*1000};await load();}
        catch(failure){if(alive())error.textContent=failure.message;}finally{if(alive())waiting(false);}};
      form.elements.password.focus();
    }
    function renderDevices(){
      error.textContent='';body.innerHTML=`<div class="devices-toolbar"><p class="devices-note">Signed in to your account</p><button type="button" data-devices-refresh>Refresh</button></div><div class="device-list">${devices.map(device=>`<article class="device-row"><div class="device-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/></svg></div><div class="device-copy"><h3>${escapeHTML(deviceName(device.userAgent))}${device.current?'<span class="device-current">This device</span>':''}</h3><p>Last active · ${escapeHTML(activity(device.lastActiveAt))}</p></div><button type="button" data-device-revoke="${escapeHTML(device.id)}">Sign out</button></article>`).join('')||'<p>No active devices.</p>'}</div><div class="devices-footer"><button type="button" data-devices-others ${devices.some(d=>!d.current)?'':'disabled'}>Sign out all other devices</button><p class="devices-note">Signed-out devices lose account access immediately and leave the app on their next online check—usually within a minute while open.</p></div>`;
      body.querySelector('[data-devices-refresh]').onclick=()=>void load();body.querySelector('[data-devices-others]').onclick=()=>confirmRevoke(null);
      body.querySelectorAll('[data-device-revoke]').forEach(button=>button.onclick=()=>confirmRevoke(devices.find(d=>d.id===button.dataset.deviceRevoke)));
    }
    async function load(){
      const request=++sequence;if(!alive())return;error.textContent='';body.innerHTML='<p class="devices-note" role="status">Loading devices…</p>';
      try{const data=await localAPI('/api/account/devices',{headers:headers()});if(!alive()||request!==sequence)return;devices=data.devices||[];renderDevices();}
      catch(failure){if(!alive()||request!==sequence)return;if(failure.code==='SEVEN_REAUTH_REQUIRED')unlock('Confirm your password again to continue.');else{error.textContent=failure.message;body.innerHTML='<button type="button" class="devices-retry">Try again</button>';body.querySelector('button').onclick=()=>void load();}}
    }
    function confirmRevoke(device){
      if(!alive()||busy)return;error.textContent='';body.innerHTML=`<h3 class="devices-confirm-title">${device?device.current?'Sign out of this device?':`Sign out ${escapeHTML(deviceName(device.userAgent))}?`:'Sign out all other devices?'}</h3><p class="devices-note">${device?.current?'You’ll need your account password to sign in again.':'They’ll need to sign in again. This device stays signed in.'}</p><div class="devices-confirm-actions"><button type="button" data-devices-cancel>Cancel</button><button type="button" class="devices-primary" data-devices-confirm>Sign out</button></div>`;
      body.querySelector('[data-devices-cancel]').onclick=renderDevices;body.querySelector('[data-devices-confirm]').onclick=async()=>{if(busy||!alive())return;waiting(true);error.textContent='';
        try{const data=await localAPI('/api/account/devices/revoke',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(device?{sessionId:device.id}:{others:true})});if(!alive())return;if(data.current){rejected({code:'SEVEN_SESSION_REVOKED'});return;}await load();}
        catch(failure){if(alive()){if(failure.code==='SEVEN_REAUTH_REQUIRED')unlock('Confirm your password again before signing out devices.');else error.textContent=failure.message;}}finally{if(alive())waiting(false);}};
      body.querySelector('[data-devices-cancel]').focus();
    }
    if(unlocked?.scope===scope&&unlocked.until>Date.now())await load();else unlock();
  }
  root.addEventListener('focus',()=>void check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  root.addEventListener('storage',event=>{if(typeof state!=='undefined'&&event.key==='cineva.supabase.session'&&!event.newValue&&state.session)rejected({code:'SEVEN_SESSION_REVOKED'});});
  root.SEVENDevices={isMain,mainId,deviceName,activity,bind,show,start,stop,check,logout,rejected};
})(window);
