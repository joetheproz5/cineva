const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const functionSource=name=>source.split(/\r?\n/).find(line=>line.startsWith(`function ${name}(`));
function fixture(kids=false,maturity='Kids'){
 const profile={id:'main',kids,preferences:{maturity,familySafe:false,blockScary:false}},context={state:{account:{activeProfileId:'main',profiles:[profile],preferences:{maturity:'13+'}}},DEFAULT_PREFERENCES:{maturity:'18+',moviesEnabled:true,seriesEnabled:true},activeProfileId:()=>context.state.account.activeProfileId,isHiddenTitle:()=>false};
 vm.createContext(context);vm.runInContext(['maturityForProfile','currentProfile','currentPreferences','updateCurrentPreferences','profileMaturity','contentType','restrictedTitles','contentGenreIds','contentAllowed'].map(functionSource).join('\n'),context);return context;
}
test('Kids-off profiles always use 18+ despite stale child ratings on the profile or account',()=>{
 for(const saved of ['Kids','13+','16+','18+',undefined]){const context=fixture(false,saved);assert.equal(context.profileMaturity(),'18+');assert.equal(context.currentPreferences().maturity,'18+');assert.equal(context.contentAllowed({id:245891,type:'movie',genre_ids:[28,53]}),true);assert.equal(context.contentAllowed({id:1,type:'movie',adult:true}),true);}
});
test('Kids-on profiles retain child restrictions even if a legacy saved value was 18+',()=>{
 const context=fixture(true,'18+');assert.equal(context.profileMaturity(),'Kids');assert.equal(context.currentPreferences().maturity,'Kids');assert.equal(context.contentAllowed({id:1,type:'movie',adult:true}),false);assert.equal(context.contentAllowed({id:1,type:'movie',genre_ids:[53]}),false);
});
test('the new maturity default does not bypass explicit family, scary-title, or title restrictions',()=>{
 const context=fixture(),profile=context.currentProfile(),item={id:245891,type:'movie',genre_ids:[28,53]};
 profile.preferences.familySafe=true;assert.equal(context.contentAllowed(item),false);
 profile.preferences.familySafe=false;profile.preferences.blockScary=true;assert.equal(context.contentAllowed(item),false);
 profile.preferences.blockScary=false;profile.restrictedTitles=[{type:'movie',id:245891}];assert.equal(context.contentAllowed(item),false);
});
test('unrelated preference saves cannot restore an old Kids maturity on a standard profile',()=>{
 const context=fixture();context.updateCurrentPreferences({language:'French',maturity:'Kids'});assert.equal(context.currentProfile().preferences.maturity,'18+');assert.equal(context.currentPreferences().language,'French');
 context.currentProfile().kids=true;context.updateCurrentPreferences({maturity:'18+'});assert.equal(context.currentProfile().preferences.maturity,'Kids');
});
test('hydration normalizes legacy profiles locally and family saves reset Kids-off maturity',()=>{
 assert.match(source,/state.account.profiles.forEach\(profile => \{\s*profile.preferences = \{[^\n]*maturity:maturityForProfile\(profile\)/);
 assert.match(source,/else \{ next.preferences.maturity = "18\+"; delete next.screenTime;/);
 assert.match(source,/name="maturity" \$\{!profile.kids \? "disabled" : ""\}/);
 assert.match(source,/maturity.disabled = !event.currentTarget.checked; maturity.value = event.currentTarget.checked \? "Kids" : "18\+"/);
});
