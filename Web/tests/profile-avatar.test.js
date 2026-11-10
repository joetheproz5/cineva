const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const web=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(web,'app.js'),'utf8'),css=fs.readFileSync(path.join(web,'auth.css'),'utf8');
const avatars=app.slice(app.indexOf('function profileAvatar(profile)'),app.indexOf('function accountNavItem('));
const context=vm.createContext({isProfileAvatar:value=>value==='assets/avatars/red-panda.png'||String(value).startsWith('data:image/png;base64,'),escapeHTML:value=>String(value).replaceAll('"','&quot;')});vm.runInContext(avatars,context);
test('all profiles without pictures use the shared generated initial avatar',()=>{
 for(const profile of [undefined,{name:'Joe',color:'#2f73c9'},{name:'J',color:'#4676c6'},{name:'Joe',color:'#d08a16',avatar:'legacy-blue'},{name:'No name'}]){
  const html=context.profileAvatar(profile),gateHtml=context.profileGateAvatar(profile);assert.match(html,/profile-avatar-initial/);assert.match(gateHtml,/profile-avatar-initial/);assert.doesNotMatch(html,/profile-avatar-guest|profile-person\.svg|#2f73c9|#4676c6|#d08a16/);assert.match(css,/\.profile-avatar\.profile-avatar-initial \{[^}]*background: var\(--profile-avatar-tone\)/);
 }
});
test('preset and uploaded pictures remain stored as-is and use optimized preset sources',()=>{
 for(const [avatar,rendered] of [['assets/avatars/red-panda.png','assets/avatars/red-panda.webp'],['data:image/png;base64,YQ==','data:image/png;base64,YQ==']]){const profile={name:'Joe',avatar,color:'#2f73c9'},copy=JSON.stringify(profile),html=context.profileAvatar(profile);assert.match(html,/profile-avatar-image/);assert.ok(html.includes(rendered));assert.doesNotMatch(html,/profile-person|#2f73c9/);assert.equal(JSON.stringify(profile),copy);assert.ok(context.profileGateAvatar(profile).includes(rendered));}
});
