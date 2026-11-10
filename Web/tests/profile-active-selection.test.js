const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const vm=require("node:vm");

const app=fs.readFileSync(path.resolve(__dirname,"..","app.js"),"utf8");
const activeStart=app.indexOf("const activeProfileId = () => {");
const activeEnd=app.indexOf("const titleOf =",activeStart);
const activeSource=app.slice(activeStart,activeEnd);
const editorStart=app.indexOf("function cleanupProfileEditorListeners()");
const editorEnd=app.indexOf("async function requestProfileEditorCancel()",editorStart);
const editorSource=app.slice(editorStart,editorEnd);

function fixture({profiles=[{id:"main",name:"Main"},{id:"second",name:"Second"}],userId="qa",marker=null}={}){
  const values=new Map(),logs=[],account={activeProfileId:null,profiles:structuredClone(profiles)};
  if(marker!==null)values.set(`seven.active-profile-choice.${userId}`,marker);
  const localStorage={getItem:key=>values.get(String(key))??null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key))};
  const context={state:{account,user:{id:userId},session:null,activeProfileSource:null,profileDraft:{id:"second"},profileEditorIsNew:true,profileSettingsCategory:"profile",profileFormReturnCategory:null,profileSettingsReturn:"account",accountProgress:[{key:"old"}],myList:[{id:1}],watchlist:[{id:2}]},ACTIVE_PROFILE_CHOICE_PREFIX:"seven.active-profile-choice.",window:{__SEVEN_DEBUG__:true},location:{hostname:"localhost"},localStorage,console:{assert:(condition,message)=>{if(!condition)throw Error(message);},info:message=>logs.push(message)},render(){this.renders=(this.renders||0)+1;},scrollToTop(){},logs};
  vm.createContext(context);
  vm.runInContext(`${activeSource}\n${editorSource}\nfunction hydrateWatchlist(){state.watchlist=[];}\nglobalThis.api={activeProfileId,restoreActiveProfileSelection,setActiveProfile,returnFromProfileEditor,removeProfileFromState};`,context);
  return context;
}

test("fresh install has no active profile and reports none",()=>{
  const app=fixture();
  assert.equal(app.api.restoreActiveProfileSelection(),null);
  assert.equal(app.api.activeProfileId(),null);
  assert.equal(app.state.account.activeProfileId,null);
  assert.deepEqual(app.logs,["[SEVEN] Active profile: none"]);
});

test("only a saved explicit picker choice is restored when its profile still exists",()=>{
  const app=fixture({marker:"second"});
  assert.equal(app.api.restoreActiveProfileSelection(),"second");
  assert.equal(app.api.activeProfileId(),"second");
  assert.equal(app.state.activeProfileSource,"restored from storage");
  assert.equal(app.localStorage.getItem("seven.active-profile-choice.qa"),"second");
  assert.equal(app.logs.at(-1),"[SEVEN] Active profile: restored from storage");
});

test("a stored choice for a deleted profile is cleared without choosing another",()=>{
  const app=fixture({profiles:[{id:"main",name:"Main"}],marker:"second"});
  assert.equal(app.api.restoreActiveProfileSelection(),null);
  assert.equal(app.api.activeProfileId(),null);
  assert.equal(app.localStorage.getItem("seven.active-profile-choice.qa"),null);
  assert.equal(app.state.account.activeProfileId,null);
});

test("profile creation keeps an already active choice and returns to its origin",()=>{
  const app=fixture();
  app.api.setActiveProfile("second","explicit tap");
  app.state.account.profiles.push({id:"new",name:"New"});
  app.state.profileFormReturnCategory=null;
  app.api.returnFromProfileEditor();
  assert.equal(app.api.activeProfileId(),"second");
  assert.equal(app.state.route,"account");
});

test("profile creation without an active choice returns to the picker",()=>{
  const app=fixture();
  app.state.account.profiles.push({id:"new",name:"New"});
  app.state.route="profile-settings";
  app.api.returnFromProfileEditor();
  assert.equal(app.api.activeProfileId(),null);
  assert.equal(app.state.route,"profiles");
});

test("deleting the active profile clears device choice and cached per-profile data",()=>{
  const app=fixture({marker:"second"});
  app.api.restoreActiveProfileSelection();
  assert.equal(app.api.removeProfileFromState("second"),true);
  assert.equal(app.api.activeProfileId(),null);
  assert.deepEqual(Array.from(app.state.account.profiles,profile=>profile.id),["main"]);
  assert.equal(app.localStorage.getItem("seven.active-profile-choice.qa"),null);
  assert.equal(app.state.accountProgress.length,0);
  assert.equal(app.state.myList.length,0);
  assert.equal(app.state.watchlist.length,0);
});

test("active-profile writes require a recognized selection source and data helpers are guarded",()=>{
  assert.match(activeSource,/console\.assert\(allowedSources\.has\(source\)/);
  assert.match(activeSource,/allowedSources = new Set\(\["explicit tap", "restored from storage"\]\)/);
  assert.match(activeSource,/const watchKey = item => activeProfileId\(\) \? `seven-progress-/);
  assert.match(app,/async function openForYou\(\) \{\s*if \(!activeProfileId\(\)\) \{ state\.route = "profiles"; render\(\); return; \}\s*state\.route = "for-you";/);
  assert.match(app,/function currentProfile\(\) \{ const id = activeProfileId\(\); return id \? state\.account\?\.profiles\?\.find\(profile => profile\.id === id\) \|\| null : null; \}/);
  assert.doesNotMatch(app,/state\.account\.profiles\[0\].*activeProfileId|activeProfileId\s*\|\|\s*["']main/);
});
