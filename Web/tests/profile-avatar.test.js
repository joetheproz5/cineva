const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const web=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(web,'app.js'),'utf8'),css=fs.readFileSync(path.join(web,'auth.css'),'utf8');
const avatars=app.slice(app.indexOf('function profileAvatar(profile)'),app.indexOf('function accountNavItem('));
const context=vm.createContext({isProfileAvatar:value=>value==='assets/avatars/red-panda.png'||String(value).startsWith('data:image/png;base64,'),escapeHTML:value=>String(value).replaceAll('"','&quot;')});vm.runInContext(avatars,context);
test('all legacy color/initial profiles use the same person icon as the selector',()=>{
 for(const profile of [undefined,{name:'Joe',color:'#2f73c9'},{name:'J',color:'#4676c6'},{name:'Joe',color:'#d08a16',avatar:'legacy-blue'},{name:'No name'}]){
  const html=context.profileAvatar(profile);assert.equal(html,context.profileGateAvatar(profile));assert.match(html,/profile-avatar-guest/);assert.match(html,/assets\/profile-person\.svg/);assert.doesNotMatch(html,/profile-avatar-initial|#2f73c9|#4676c6|#d08a16|>J</);
 }
});
test('chosen and uploaded pictures remain unchanged and ignore legacy fallback colors',()=>{
 for(const avatar of ['assets/avatars/red-panda.png','data:image/png;base64,YQ==']){const profile={name:'Joe',avatar,color:'#2f73c9'},copy=JSON.stringify(profile),html=context.profileAvatar(profile);assert.match(html,/profile-avatar-image/);assert.ok(html.includes(avatar));assert.doesNotMatch(html,/profile-person|#2f73c9/);assert.equal(JSON.stringify(profile),copy);assert.equal(context.profileGateAvatar(profile),html);}
});
test('shared fallback styling covers the higher-specificity header avatar rule',()=>{
 assert.match(css,/\.profile-avatar\.profile-avatar-guest \{[^}]*background: radial-gradient\(circle at 50% 35%, #16090b/);
 assert.match(css,/\.profile-avatar\.profile-avatar-guest img \{[^}]*width: 58%; height: 58%;[^}]*object-fit: contain/);
 assert.match(css,/\.account\.signed-in \.profile-avatar\.profile-avatar-guest \{[^}]*background: radial-gradient/);
 assert.doesNotMatch(avatars,/profile\?\.color|slice\(0, 1\)/);
});
