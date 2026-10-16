/* Presentation and draft continuity for settings; existing save/auth handlers remain authoritative. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root.document)root.SEVENSettingsUI=api;
})(typeof window==="undefined"?globalThis:window,function(root){
  const secret=field=>field.type==="password"||field.type==="file"||/(pin|password|secret|token|code)/i.test(field.name||field.id||"");
  const paths={
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    shield:'<path d="m12 3 8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    devices:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8m-4-5v5"/>',
    password:'<circle cx="8" cy="9" r="4"/><path d="m11 12 9 9m-3-3 3-3m-6 0 3-3"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    history:'<path d="M4 8a8.5 8.5 0 1 1-1 7M3 3v6h6m3-2v6l4 2"/>',
    exit:'<path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    stats:'<path d="M4 20V10m5 10V4m6 16v-7m5 7V8"/>',
    heart:'<path d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7z"/>',
    eye:'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9 5.3C10 5.1 11 5 12 5c6 0 10 7 10 7a20 20 0 0 1-4 4M6 6a20 20 0 0 0-4 6s4 7 10 7c1.5 0 3-.3 4.3-.9"/>',
    titles:'<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M8 7h5m-5 4h5m7-4v14H8"/>',
    arrow:'<path d="m9 5 7 7-7 7"/>'
  };
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.lock}</svg>`;
  const translate=value=>typeof t==="function"?t(value):value;
  let draft=null,trigger=null;const dialogs=new Map();let observer=null;
  function scope(){return JSON.stringify([state.user?.id||"guest",state.profileDraft?.id,state.profileSettingsCategory||"home"]);}
  function capture(){
    const page=root.document?.querySelector(".profile-settings-redesign[data-settings-scope]");
    if(!page){draft=null;return;}
    draft={scope:page.dataset.settingsScope,fields:[...page.querySelectorAll("#profile-settings-form input, #profile-settings-form select, #profile-settings-form textarea")].filter(field=>!secret(field)&&(field.name||field.id)).map(field=>({name:field.name,id:field.id,type:field.type,value:field.value,checked:field.checked})),open:[...page.querySelectorAll("details[data-settings-disclosure][open]")].map(el=>el.dataset.settingsDisclosure)};
  }
  function decorateActions(page){
    const icons=[["[data-change-parent-code]","shield"],["[data-change-password]","password"],["[data-manage-devices]","devices"],["[data-install-seven]","download"],["[data-clear-history]","history"],["[data-signout]","exit"],["[data-remove-profile]","trash"],["[data-profile-stats]","stats"],["[data-my-list]","heart"],["[data-view-history]","history"],["[data-liked-titles]","heart"],["[data-hidden-titles]","eye"]];
    page.querySelectorAll(".account-action-card:not(.settings-action-row)").forEach(button=>{button.type="button";button.classList.add("settings-action-row");const name=button.matches('[data-watchlist]')?"titles":icons.find(([selector])=>button.matches(selector))?.[1]||"lock",icon=button.querySelector(":scope > i");if(icon)icon.innerHTML=svg(name);});
  }
  function disclosure(card,key,title,description,icon,value="",keepCopy=false){
    const details=root.document.createElement("details");details.className="settings-disclosure";details.dataset.settingsDisclosure=key;
    const summary=root.document.createElement("summary");summary.className="settings-action-row";
    summary.innerHTML=`<i>${svg(icon)}</i><span><b></b><small></small></span><em><span></span>${svg("arrow")}</em>`;
    summary.querySelector("b").textContent=translate(title);summary.querySelector("small").textContent=translate(description);summary.querySelector("em span").textContent=translate(value);
    const body=root.document.createElement("div");body.className="settings-disclosure-body";
    [...card.childNodes].forEach(child=>{if(child.nodeType===1&&(child.matches(".brand,h2")||!keepCopy&&child.matches("p:not([class])")))child.remove();else body.append(child);});
    details.append(summary,body);card.replaceChildren(details);card.classList.add("settings-disclosure-card");
    summary.addEventListener("click",()=>queueMicrotask(()=>{if(details.open)body.querySelector('input:not([type="checkbox"]):not([disabled]), select:not([disabled])')?.focus({preventScroll:true});}));
    return {details,body};
  }
  function syncLimits(page){
    const kids=page.querySelector('[name="kids"]');if(!kids)return;
    const maturity=page.querySelector('[name="maturity"]');if(maturity){maturity.disabled=!kids.checked;if(!kids.checked)maturity.value="18+";}
    const note=page.querySelector('.screen-time-rows .profile-mobile-toggle small');if(note)note.textContent=translate(kids.checked?"Limit how long this profile can watch each day.":"Turn on Kids profile to use screen time limits.");
    const rows=page.querySelector(".screen-time-rows"),enabled=kids.checked&&parentAccessConfigured();rows?.classList.toggle("row-disabled",!enabled);rows?.querySelectorAll("input,select").forEach(field=>field.disabled=!enabled);
  }
  function syncParentActions(page){
    const hasCode=parentAccessConfigured();
    page?.querySelectorAll('[data-change-parent-code]').forEach(button=>{
      const title=hasCode?"Change parent access code":"Set parent access code",description=hasCode?"Confirm your current code before changing or turning it off.":"Protect profile and account settings without locking the profile picker.";
      button.querySelector('b').textContent=translate(title);button.querySelector('small').textContent=translate(description);button.querySelector('em').textContent=translate(hasCode?"Change":"Set")+" ›";
    });
  }
  function enhance(){
    const page=root.document.querySelector(".profile-settings-redesign");if(!page)return;
    page.dataset.settingsScope=scope();
    page.querySelectorAll(".parent-access-card").forEach(card=>{const action=card.querySelector("[data-change-parent-code]");if(action){card.replaceChildren(action);card.classList.add("settings-parent-row");}});
    const pin=page.querySelector('.profile-pin-card:has(input[name="pin"])');
    if(pin){
      const label=state.profileDraft?.pinHash?"Change profile PIN":"Set a profile PIN",view=disclosure(pin,"profile-pin","Profile PIN","Keep this profile private on shared devices.","lock",state.profileDraft?.pinHash?"Change":"Set");
      const actions=page.querySelector("#profile-settings-form > .profile-settings-actions"),error=page.querySelector("#profile-error");if(error)view.body.append(error);if(actions)view.body.append(actions);
      const cancel=root.document.createElement("button");cancel.type="button";cancel.className="settings-cancel";cancel.textContent=translate("Cancel");view.body.querySelector(".profile-settings-actions")?.prepend(cancel);
      cancel.onclick=()=>{view.body.querySelectorAll("input").forEach(field=>{if(field.type==="checkbox")field.checked=false;else field.value="";});if(error)error.textContent="";view.details.open=false;view.details.querySelector("summary").focus();};
      const field=view.body.querySelector('input[name="pin"]');field?.setAttribute("aria-label",translate(label));
    }
    const restrictions=page.querySelector(".family-restrictions");
    if(restrictions){
      const count=restrictions.querySelectorAll("[data-unblock-title]").length,view=disclosure(restrictions,"blocked-titles","Block specific titles","Choose which titles this profile can’t see.","titles",count?String(count):"Manage");
      const error=root.document.createElement("p");error.id="family-title-error";error.className="form-error";error.setAttribute("role","alert");view.body.prepend(error);
      const input=view.body.querySelector("#family-title-search");if(input){input.type="search";input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();event.stopPropagation();view.body.querySelector("[data-family-search]")?.click();}});}
    }
    const dns=page.querySelector(".dns-filtering-card");if(dns)disclosure(dns,"dns","Ad blocking on iPhone","View optional device-wide DNS filtering.","shield","View",true);
    decorateActions(page);
    if(draft?.scope===page.dataset.settingsScope){
      for(const saved of draft.fields){const field=[...page.querySelectorAll("#profile-settings-form input,#profile-settings-form select,#profile-settings-form textarea")].find(field=>saved.name?field.name===saved.name:field.id===saved.id);if(!field||secret(field))continue;if(["checkbox","radio"].includes(saved.type))field.checked=saved.checked;else field.value=saved.value;}
      page.querySelectorAll("details[data-settings-disclosure]").forEach(el=>el.open=draft.open.includes(el.dataset.settingsDisclosure));
    }
    syncLimits(page);page.querySelector('[name="kids"]')?.addEventListener("change",()=>syncLimits(page));draft=null;
    // A Kids security page has only a parent-code action, not a second empty save form.
    page.querySelectorAll("#profile-settings-form").forEach(form=>{if(!form.querySelector("input[name],select[name],textarea[name]"))form.querySelector(".profile-settings-actions")?.setAttribute("hidden","");});
    watchDialogs();
  }
  function scanDialogs(){
    const page=root.document.querySelector('.profile-settings-redesign');if(page)decorateActions(page);
    if(root.document.querySelector(".profile-settings-redesign"))root.document.querySelectorAll(".modal:not(.settings-dialog)").forEach(modal=>{
      if(!modal.matches(".password-change,.parent-setup,.parent-code-change,.parent-unlock,.devices-modal,.profile-unlock,.install-modal,.settings-confirmation"))return;
      modal.classList.add("settings-dialog");const pane=modal.querySelector(":scope > form,:scope > section");if(!pane)return;
      pane.setAttribute("role","dialog");pane.setAttribute("aria-modal","true");pane.setAttribute("aria-label",pane.querySelector("h2,h3")?.textContent||translate("Settings"));
      pane.querySelectorAll('input[inputmode="numeric"]').forEach(field=>field.type="password");
      modal.querySelectorAll("[data-close],[data-devices-close],[data-close-install]").forEach(button=>button.setAttribute("aria-label",translate("Close")));
      const entry={trigger:trigger?.isConnected?trigger:null};dialogs.set(modal,entry);
      modal.addEventListener("keydown",event=>{
        if(modal.classList.contains("devices-modal"))return; // This modal already has a busy-aware focus trap.
        if(event.key==="Escape"){event.preventDefault();modal.querySelector("[data-close]:not(:disabled),[data-close-install]:not(:disabled)")?.click();}
        if(event.key!=="Tab")return;
        const controls=[...pane.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]")].filter(el=>el.getClientRects().length);if(!controls.length)return;
        if(event.shiftKey&&root.document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&root.document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
      });
      if(!pane.contains(root.document.activeElement))pane.querySelector('input:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true});
    });
    for(const [modal,entry]of dialogs)if(!modal.isConnected){dialogs.delete(modal);entry.onRemoved?.();syncParentActions(root.document.querySelector('.profile-settings-redesign'));const remaining=[...root.document.querySelectorAll(".modal")].at(-1);if(entry.trigger?.isConnected&&root.document.activeElement===root.document.body&&(!remaining||remaining.contains(entry.trigger)))entry.trigger.focus({preventScroll:true});}else if(root.document.activeElement===root.document.body&&[...root.document.querySelectorAll(".modal")].at(-1)===modal){modal.querySelector('input:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true});}
  }
  function watchDialogs(){if(observer)return;observer=new root.MutationObserver(scanDialogs);observer.observe(root.document.querySelector("#app")||root.document.body,{childList:true,subtree:true});root.document.addEventListener("click",event=>{if(event.target.closest(".profile-settings-redesign,.settings-dialog"))trigger=event.target.closest("button,summary,a");},true);}
  function confirmAction(message,{title="Are you sure?",confirmLabel="Confirm",danger=false}={}){
    if(!root.document?.querySelector(".profile-settings-redesign"))return Promise.resolve(root.confirm(message));
    const before=scope();return new Promise(resolve=>{
      const modal=root.document.createElement("div");modal.className="modal settings-confirmation";modal.innerHTML=`<section class="settings-confirmation-panel"><button class="modal-close" type="button" data-close aria-label="Close">×</button><h2></h2><p></p><div class="settings-confirmation-actions"><button type="button" class="settings-cancel" data-cancel></button><button type="button" class="primary" data-confirm></button></div></section>`;
      modal.querySelector("h2").textContent=translate(title);modal.querySelector("p").textContent=message;modal.querySelector("[data-cancel]").textContent=translate("Cancel");modal.querySelector("[data-confirm]").textContent=translate(confirmLabel);modal.classList.toggle("settings-confirm-danger",danger);
      const finish=value=>{resolve(value&&before===scope());modal.remove();};modal.querySelector("[data-close]").onclick=()=>finish(false);modal.querySelector("[data-cancel]").onclick=()=>finish(false);modal.querySelector("[data-confirm]").onclick=()=>finish(true);
      root.document.querySelector("#app").append(modal);watchDialogs();scanDialogs();dialogs.get(modal).onRemoved=()=>resolve(false);modal.querySelector("[data-cancel]").focus();
    });
  }
  return {capture,enhance,confirm:confirmAction,isSecretField:secret};
});
