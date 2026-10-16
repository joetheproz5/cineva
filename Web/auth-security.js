/* Account security UI. All permission checks and verification are also enforced server-side. */
(function(root){
  let activeGate=null;
  const headers=token=>({'Content-Type':'application/json',Authorization:'Bearer '+token,...(typeof activeProfileId==='function'?{'X-Seven-Profile':activeProfileId()}:{})});
  async function api(action,token,body){const send=()=>localAPI('/api/auth/mfa/'+action,{signal:AbortSignal.timeout(20000),method:body===undefined?'GET':'POST',headers:headers(token),...(body===undefined?{}:{body:JSON.stringify(body)})});return ['verify','disable'].includes(action)?withSessionRefreshLock(send):send();}
  function modal(title,copy){
    const previous=document.activeElement,element=document.createElement('div');element.className='modal account-security-modal';element.innerHTML='<section class="auth-card" role="dialog" aria-modal="true"><button type="button" class="modal-close" data-close aria-label="Close">×</button><span class="brand">ACCOUNT SECURITY</span><h2></h2><p data-copy></p><div data-body></div><p class="form-error" role="status" aria-live="polite" data-error></p></section>';
    const heading=element.querySelector('h2');heading.id='account-security-heading';heading.textContent=title;element.querySelector('section').setAttribute('aria-labelledby',heading.id);element.querySelector('[data-copy]').textContent=copy;document.body.append(element);let onClose=()=>{};
    function close(force=false){if(!force&&element.querySelector('button[type=submit]:disabled'))return;element.querySelectorAll('input').forEach(field=>field.value='');element.remove();if(previous?.isConnected)previous.focus();onClose();}
    element.querySelector('[data-close]').onclick=()=>close();element.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const controls=[...element.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length);if(!controls.length)return;if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}});
    const body=element.querySelector('[data-body]'),error=element.querySelector('[data-error]');return {element,body,error,close,onClose:callback=>onClose=callback};
  }
  function verify(data,factors,{disable=false}={}){
    if(activeGate)return Promise.reject(Error('Finish the current security check first.'));
    return new Promise((resolve,reject)=>{
      const dialog=modal(disable?'Turn off two-step verification':'Two-step verification','Enter a code from your authenticator app.'),token=data.session.access_token;let done=false,busy=false;activeGate=dialog;
      dialog.body.innerHTML='<form><label>Authenticator<select name="factor"></select></label><label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" class="primary auth-submit">Continue</button></form>';
      for(const factor of factors){const option=document.createElement('option');option.value=factor.id;option.textContent=factor.name||'Authenticator app';dialog.body.querySelector('select').append(option);}if(factors.length===1)dialog.body.querySelector('select').parentElement.hidden=true;
      dialog.onClose(()=>{activeGate=null;if(!done){const error=Error('Verification cancelled.');error.status=403;reject(error);}});
      dialog.body.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;dialog.error.textContent='';try{const result=await api(disable?'disable':'verify',token,{factorId:form.elements.factor.value,code:form.elements.code.value});if(!result.session?.access_token)throw Error('Verification could not be confirmed.');done=true;dialog.close(true);resolve(result);}catch(error){dialog.error.textContent=error.message;form.elements.code.value='';form.elements.code.focus();}finally{busy=false;button.disabled=false;}};
      dialog.body.querySelector('input').focus();
    });
  }
  async function complete(data){
    if(!data.session?.access_token)return data;
    if(data.session.cookie_session){const check=await localAPI('/api/auth/cookie-status',{signal:AbortSignal.timeout(12000)});if(check.cookie!==true)throw Error('Allow first-party cookies to stay signed in to SEVEN.');}
    const status=await api('status',data.session.access_token);
    if(typeof status.required!=='boolean')throw Error('Could not confirm account security. Please try again.');
    if(status.required)data=await verify(data,status.factors);
    const email=await emailAPI('status',data.session.access_token);
    if(typeof email.required!=='boolean')throw Error('Could not confirm email security. Please try again.');
    if(email.required)await emailCode(data.session.access_token,'signin');
    return data;
  }
  const emailAPI=(action,token,body)=>localAPI('/api/auth/email/'+action,{signal:AbortSignal.timeout(25000),method:body===undefined?'GET':'POST',headers:headers(token),...(body===undefined?{}:{body:JSON.stringify(body)})});
  async function emailCode(token,purpose,password){
    if(activeGate)throw Error('Finish the current security check first.');
    const dialog=modal('Check your email','Sending your security code…');activeGate=dialog;let done=false,timer=null;
    return new Promise((resolve,reject)=>{
      dialog.onClose(()=>{clearInterval(timer);activeGate=null;if(!done)reject(Error('Email verification cancelled.'));});
      const send=async()=>{
        dialog.error.textContent='';dialog.body.innerHTML='<p>Sending…</p>';
        try{
          const challenge=await emailAPI('send',token,{purpose,...(password?{password}:{})});password='';
          if(!challenge.id)throw Error('Could not request a code.');
          if(!dialog.element.isConnected)return;
          dialog.element.querySelector('[data-copy]').textContent='Enter the code sent to '+challenge.email+'. It expires in 10 minutes.';
          dialog.body.innerHTML='<form><label>Email code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="([0-9]{6}|[0-9]{8})" maxlength="8" required></label><button type="submit" class="primary auth-submit">'+(purpose==='enable'?'Enable email verification':purpose==='disable'?'Turn off email verification':'Continue')+'</button></form><button type="button" class="secondary" data-resend disabled>Resend in 60s</button>';
          const resend=dialog.body.querySelector('[data-resend]');let wait=60;
          timer=setInterval(()=>{if(!dialog.element.isConnected)return clearInterval(timer);wait--;resend.textContent=wait>0?'Resend in '+wait+'s':purpose==='signin'?'Resend code':'Request a new code';resend.disabled=wait>0;if(wait<=0)clearInterval(timer);},1000);
          resend.onclick=()=>{if(purpose==='signin')void send();else{done=true;dialog.close(true);resolve({restart:true});}};
          dialog.body.querySelector('form').onsubmit=async event=>{
            event.preventDefault();const form=event.currentTarget,submit=form.querySelector('button');if(submit.disabled)return;submit.disabled=true;resend.disabled=true;dialog.error.textContent='';
            try{const result=await emailAPI('verify',token,{id:challenge.id,code:form.elements.code.value});if(!result.ok)throw Error('Could not confirm your code.');done=true;dialog.close(true);resolve(result);}
            catch(error){dialog.error.textContent=error.message;form.elements.code.value='';form.elements.code.focus();}
            finally{submit.disabled=false;resend.disabled=wait>0;}
          };dialog.body.querySelector('input').focus();
        }catch(error){password='';if(!dialog.element.isConnected)return;dialog.error.textContent=error.message;dialog.body.innerHTML='<button type="button" class="secondary" data-retry>Try again</button>';dialog.body.querySelector('button').onclick=()=>{if(purpose==='signin')void send();else{done=true;dialog.close(true);resolve({restart:true});}};}
      };void send();
    });
  }
  async function manageEmail(){
    if(!root.SEVENDevices?.isMain())return showToast('Use the main profile to change account security.');
    if(!state.session?.access_token)return showAuth('login');
    let dialog;
    try{
      const checked=await complete({session:state.session});persistSession(checked.session);
      const token=state.session.access_token,status=await emailAPI('status',token),purpose=status.enabled?'disable':'enable';
      dialog=modal(status.enabled?'Turn off email verification':'Set up email verification',status.enabled?'Confirm your password and a fresh email code. Your authenticator setting will not change.':'After your password, SEVEN will ask for a code sent to your email. If you enable an authenticator too, both checks are required.');
      dialog.body.innerHTML='<form><label>Account password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit" class="primary auth-submit">Send code</button></form>';
      dialog.body.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('button');if(submit.disabled)return;submit.disabled=true;const password=form.elements.password.value;form.elements.password.value='';dialog.close(true);try{const result=await emailCode(token,purpose,password);if(result.restart)return manageEmail();showToast(result.enabled?'Email verification enabled.':'Email verification turned off.');}catch(error){showToast(error.message);}};
      dialog.body.querySelector('input').focus();
    }catch(error){showToast(error.message);}
  }
  async function manage(){
    if(!root.SEVENDevices?.isMain())return showToast('Use the main profile to change account security.');
    const token=state.session?.access_token;if(!token)return showAuth('login');
    let dialog;
    try{
      const status=await api('status',token);
      if(status.required){const upgraded=await verify({session:state.session},status.factors);persistSession(upgraded.session);return manage();}
      if(status.enabled){const upgraded=await verify({session:state.session},status.factors,{disable:true});persistSession(upgraded.session);state.user=upgraded.user||upgraded.session.user||state.user;showToast('Two-step verification turned off.');return;}
      dialog=modal('Set up two-step verification','Use an authenticator app to protect your SEVEN account.');let enrollment=null,busy=false,confirmed=false;
      dialog.body.innerHTML='<form><label>Account password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary auth-submit" type="submit">Continue</button></form>';
      dialog.onClose(()=>{if(enrollment&&!confirmed)void api('cancel',token,{factorId:enrollment.id}).catch(()=>{});});
      dialog.body.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;dialog.error.textContent='';try{
        enrollment=await api('enroll',token,{password:form.elements.password.value});form.elements.password.value='';if(!enrollment.id||!enrollment.secret)throw Error('Could not create an authenticator setup key.');
        dialog.body.innerHTML='<p>Add this setup key to your authenticator as a time-based account. Keep a secure backup of your authenticator: losing access can lock you out.</p><code class="auth-setup-key"></code><button class="secondary" type="button" data-copy-key>Copy setup key</button><form><label>Code from your authenticator<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" class="primary auth-submit">Enable two-step verification</button></form>';
        dialog.body.querySelector('code').textContent=enrollment.secret;dialog.body.querySelector('[data-copy-key]').onclick=async()=>{try{await navigator.clipboard.writeText(enrollment.secret);showToast('Setup key copied.');}catch{dialog.error.textContent='Select and copy the setup key above.';}};
        dialog.body.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;dialog.error.textContent='';try{const result=await api('verify',token,{factorId:enrollment.id,code:form.elements.code.value});if(!result.session?.access_token)throw Error('Verification could not be confirmed.');confirmed=true;persistSession(result.session);state.user=result.user||result.session.user||state.user;enrollment.secret='';dialog.close(true);showToast('Two-step verification enabled.');}catch(error){dialog.error.textContent=error.message;form.elements.code.value='';}finally{button.disabled=false;}};dialog.body.querySelector('input').focus();
      }catch(error){dialog.error.textContent=error.message;}finally{busy=false;button.disabled=false;}};dialog.body.querySelector('input').focus();
    }catch(error){if(dialog?.element.isConnected)dialog.error.textContent=error.message;else showToast(error.message);}
  }
  function bind(){
    if(typeof state==='undefined')return;
    document.querySelectorAll('[data-change-password]').forEach(button=>{if(button.parentElement.querySelector('[data-two-step]')||!root.SEVENDevices?.isMain())return;const row=document.createElement('button');row.type='button';row.className='account-action-card settings-action-row';row.dataset.twoStep='';row.innerHTML='<i aria-hidden="true">⌁</i><span><b>Authenticator app</b><small>Two-step verification · recommended</small></span><em>Manage ›</em>';row.onclick=()=>void manage();button.after(row);const email=document.createElement('button');email.type='button';email.className='account-action-card settings-action-row';email.dataset.emailSecurity='';email.innerHTML='<i aria-hidden="true">✉</i><span><b>Email verification</b><small>Require an email code after your password</small></span><em>Manage ›</em>';email.onclick=()=>void manageEmail();row.after(email);});
  }
  root.SEVENAuthSecurity={complete,manage,manageEmail};
  new MutationObserver(bind).observe(document.querySelector('#app'),{childList:true,subtree:true});
})(window);
