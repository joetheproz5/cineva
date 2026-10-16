const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=require('../settings-ui'),base=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(base,name),'utf8'),app=read('app.js'),script=read('settings-ui.js'),css=read('settings-ui.css');
test('settings draft continuity never remembers PINs, passwords, tokens, codes or files',()=>{
 for(const field of [{type:'password',name:'anything'},{type:'file',name:'avatar'},{type:'text',name:'currentPin'},{type:'text',name:'confirmPin'},{type:'text',name:'parentPin'},{type:'text',name:'token'},{type:'text',name:'code'}])assert.equal(ui.isSecretField(field),true);
 for(const field of [{type:'checkbox',name:'kids'},{type:'select-one',name:'maturity'},{type:'select-one',name:'screenTimeMinutes'},{type:'text',id:'family-title-search'},{type:'select-one',name:'playerProvider'}])assert.equal(ui.isSecretField(field),false);
 assert.doesNotMatch(script,/localStorage|sessionStorage/);
});
test('every settings render captures safe fields before replacement and enhances after bindings',()=>{
 const source=app.slice(app.indexOf('function renderProfileSettings()'),app.indexOf('function renderAccount()'));
 assert.ok(source.indexOf('SEVENSettingsUI?.capture()')<source.indexOf('app.innerHTML'));
 assert.ok(source.indexOf('SEVENSettingsUI?.enhance()')>source.indexOf('[data-remove-profile]'));
 assert.match(script,/draft\?\.scope===page.dataset.settingsScope/);assert.match(script,/state.user\?\.id/);
});
test('native dropdown controls stack below their descriptions at all viewport sizes',()=>{
 assert.match(css,/profile-mobile-row\.profile-mobile-select \{[^}]*grid-template-columns:minmax\(0,1fr\);[^}]*grid-template-areas:"copy" "control"/);
 assert.match(css,/profile-mobile-select > select,[\s\S]*?width:100%; min-width:0; max-width:none/);
 assert.match(css,/@media\(max-width:720px\)[\s\S]*?max-width:none; width:100%; font-size:16px/);
});
test('complex sections open as accessible disclosures while existing parent and save actions remain bound',()=>{
 for(const key of ['profile-pin','blocked-titles','dns'])assert.ok(script.includes('"'+key+'"'));
 assert.match(script,/createElement\("details"\)/);assert.match(script,/createElement\("summary"\)/);
 assert.match(script,/card.replaceChildren\(action\)/);assert.match(script,/button.type="button"/);
 assert.match(script,/key==="Enter"[^\n]*preventDefault[^\n]*data-family-search/);
 assert.match(app,/data-change-parent-code[^\n]*showParentCodeChange/);
});
test('confirmation dialogs are scoped, cancellable, keyboard accessible and required for destructive actions',()=>{
 assert.match(script,/resolve\(value&&before===scope\(\)\)/);assert.match(script,/onRemoved=\(\)=>resolve\(false\)/);
 assert.match(script,/aria-modal/);assert.match(script,/key==="Escape"/);assert.match(script,/event.shiftKey/);
 assert.match(app,/SEVENSettingsUI.confirm[^\n]*title:"Clear viewing history\?"/);
 assert.match(app,/SEVENSettingsUI.confirm[^\n]*title:"Delete profile\?"/);
 assert.match(app,/SEVENSettingsUI.confirm[^\n]*title:"Sign out of SEVEN\?"/);
 assert.match(app,/const profileId = profile.id, prefix = `seven-progress-/);
});
test('settings assets are versioned and available in the offline app shell',()=>{
 const index=read('index.html'),sw=read('service-worker.js');
 for(const asset of ['settings-ui.js?v=1','settings-ui.css?v=1']){assert.ok(index.includes(asset));assert.ok(sw.includes(asset));}
 assert.ok(index.indexOf('settings-ui.js?v=1')<index.indexOf('app.js?v=382'));assert.match(sw,/seven-v382/);
});
test('phone password confirmation stays above the fixed bottom navigation',()=>{
 assert.match(css,/password-success \{ z-index:10011/);assert.match(css,/password-success \{ bottom:calc\(82px \+ env\(safe-area-inset-bottom\)\)/);
});
