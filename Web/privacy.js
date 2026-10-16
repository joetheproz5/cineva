/* Device-local, opt-in usage statistics. Essential account features are independent. */
(function(root){
  'use strict';
  const cookie='seven_optional_analytics',visitorKey='seven.daily-visit.v1';let lastAllowed=false,disabledHere=false;
  const blocked=()=>navigator.doNotTrack==='1'||root.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const persisted=()=>{try{const choices=document.cookie.split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookie+'='));return choices.length===1&&choices[0]===cookie+'=allow';}catch{return false;}};
  const allowed=()=>!disabledHere&&!blocked()&&persisted();
  function publish(){const next=allowed();if(next!==lastAllowed){lastAllowed=next;root.dispatchEvent(new CustomEvent('seven:privacy-change',{detail:{analytics:next}}));}paint();}
  function setAnalytics(value){
    const enabled=value===true&&!blocked();
    disabledHere=!enabled;
    try{document.cookie=cookie+'='+(enabled?'allow':'deny')+'; Path=/; Max-Age=15552000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');}catch{}
    disabledHere=!enabled&&persisted();
    if(!enabled)try{localStorage.removeItem(visitorKey);}catch{}
    publish();return allowed();
  }
  function content(){return '<p class="seven-privacy-eyebrow">ON THIS DEVICE</p><h1 id="seven-privacy-title">Your privacy choices.</h1><p>Optional analytics are off unless you enable them. Signing in, saving titles and syncing your viewing history work either way.</p><label class="seven-privacy-toggle"><span><b>Optional usage analytics</b><small>Count visits, downloads and playback time for SEVEN’s usage dashboard. No session replay or keystroke recording.</small></span><input type="checkbox" role="switch" aria-label="Optional usage analytics" data-analytics-choice></label><p class="seven-privacy-status" role="status" aria-live="polite" data-privacy-status></p><details><summary>What SEVEN stores and connects to</summary><p><b>Account features.</b> Supabase handles sign-in and stores your account, profile names/photos, preferences, saved titles and viewing progress. Cloudflare hosts the service; Brevo delivers verification and security emails. Essential session cookies and local storage keep these features working.</p><p><b>Your choices.</b> Use a nickname and a photo you own or have permission to use. You can replace your profile photo, remove a profile or clear its viewing history in Settings.</p><p><b>Optional statistics.</b> When enabled, SEVEN uses a daily random visitor ID, daily server-side hashes and bounded playback-time events. This preference applies to this browser/app, not every device on your account. Turning it off stops future optional events and removes this device’s visitor ID; it does not erase already-recorded totals.</p><p><b>Other services.</b> TMDB supplies metadata and image files. Trailers and playback can load third-party services with their own data practices. This analytics choice does not control those services or remove essential hosting/security requests. SEVEN uses system fonts, not Google-hosted fonts.</p></details>';}
  function paint(){document.querySelectorAll('[data-analytics-choice]').forEach(input=>{input.checked=allowed();input.disabled=blocked();});document.querySelectorAll('[data-privacy-status]').forEach(status=>{status.textContent=blocked()?'Your browser privacy signal keeps optional analytics off.':allowed()?'Optional analytics are on. You can turn them off here at any time.':'Optional analytics are off. Your account features still work.';});}
  function bind(container){container.querySelector('[data-analytics-choice]')?.addEventListener('change',event=>{const requested=event.currentTarget.checked,enabled=setAnalytics(requested);if(requested&&!enabled&&!blocked())container.querySelector('[data-privacy-status]').textContent='Could not remember this choice. Optional analytics remain off.';else if(!requested&&persisted())container.querySelector('[data-privacy-status]').textContent='Analytics are off for this visit, but your browser could not save that choice. Check its cookie settings before reopening.';});paint();}
  function show(){
    if(document.querySelector('.seven-privacy-overlay'))return;
    const previous=document.activeElement,overlay=document.createElement('div');overlay.className='seven-privacy-overlay';overlay.innerHTML='<section class="seven-privacy-panel" role="dialog" aria-modal="true" aria-labelledby="seven-privacy-title"><button class="seven-privacy-close" type="button" aria-label="Close privacy choices">×</button>'+content()+'</section>';document.body.append(overlay);
    const close=()=>{overlay.remove();if(previous?.isConnected)previous.focus();};overlay.querySelector('.seven-privacy-close').onclick=close;
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key!=='Tab')return;const controls=[...overlay.querySelectorAll('button,input:not(:disabled),summary,a')].filter(control=>control.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});bind(overlay);overlay.querySelector('button').focus();
  }
  root.SevenPrivacy=Object.freeze({analyticsAllowed:allowed,setAnalytics,show});lastAllowed=allowed();
  if(!lastAllowed)try{localStorage.removeItem(visitorKey);}catch{}
  const page=document.querySelector('[data-privacy-page]');if(page){page.innerHTML=content();bind(page);}
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-privacy-settings]')){event.preventDefault();show();}});
  root.addEventListener('focus',publish);document.addEventListener('visibilitychange',()=>{if(!document.hidden)publish();});
})(window);
