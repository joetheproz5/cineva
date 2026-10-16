const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),test=require("node:test"),vm=require("node:vm");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const sessionFunctions=app.slice(app.indexOf("let sessionAuthGeneration=0;"),app.indexOf("\nasync function restoreSession()"));
const session=(id="member-1")=>({access_token:"memory-access-"+id,cookie_session:true,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:"fixture@example.test"},seven_started_at:Date.now()-60000});
function createContext({initial=session(),localAPI,lockRequest}={}){
  const values=new Map([["cineva.supabase.session",JSON.stringify({cookie_session:true,user:initial.user,seven_started_at:initial.seven_started_at})]]),state={session:initial,user:initial.user,accountProgress:[],watchlistPending:new Set()};
  const context={state,SESSION_KEY:"cineva.supabase.session",ACCOUNT_OWNER_KEY:"seven.account.owner",MY_LIST_KEY:"seven.my-list",SESSION_REFRESH_LOCK:"seven-auth-session-refresh",window:{addEventListener(){},SEVENAuthSecurity:{complete:async data=>data}},navigator:{locks:{request:lockRequest||((_name,_options,task)=>task())}},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},sessionStorage:{removeItem(){}},localAPI:localAPI||(async()=>({session:session()})),flushWatchTypeChange(){},flushWatchTime(){},flushProfileWatchStats(){},clearWatchlistCache(){},defaultAccount:()=>({}),reportAccountVisit(){},clearTimeout,setTimeout:()=>1,Date,Math};
  context.AbortSignal=AbortSignal;context.playbackWatch={buffered:0};vm.createContext(context);vm.runInContext("let sessionRefreshPromise; let sessionRefreshTimer;\n"+sessionFunctions,context);return {context,state,values};
}
test("access and refresh tokens are never written by persistSession",()=>{
 const {context,values}=createContext(),value={...session(),refresh_token:"must-not-persist",user:{...session().user,user_metadata:{access_token:"nested-secret"}}};context.persistSession(value);
 const stored=values.get("cineva.supabase.session");assert.equal(stored.includes(value.access_token),false);assert.equal(stored.includes(value.refresh_token),false);assert.equal(stored.includes("nested-secret"),false);assert.equal(JSON.parse(stored).cookie_session,true);assert.equal(context.state.session.access_token,value.access_token);
});
test("cookie refresh sends no renewable credential in JSON and preserves long-lived sign-in",async()=>{
 const initial={...session(),seven_started_at:Date.now()-90*86400000},calls=[];const {context}=createContext({initial,localAPI:async(url,options)=>{calls.push({url,options});return {session:{...session(),seven_started_at:initial.seven_started_at}};}});
 const result=await context.refreshSession();assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].options.body),{});assert.equal(result.seven_started_at,initial.seven_started_at);assert.doesNotMatch(app,/SESSION_MAX_AGE|sessionExpired\(/);
});
test("simultaneous refreshes share one request and wait for the browser-wide lock",async()=>{
 let release,calls=0,locks=0;const gate=new Promise(done=>release=done),{context}=createContext({lockRequest:(_name,_options,task)=>{locks++;return gate.then(task);},localAPI:async()=>{calls++;return {session:session()};}});
 const a=context.refreshSession(),b=context.refreshSession();assert.equal(locks,1);release();assert.equal((await a).access_token,(await b).access_token);assert.equal(calls,1);
});
test("legacy refresh token migrates once, then only a non-secret cache remains",async()=>{
 const initial={...session(),cookie_session:false,refresh_token:"legacy-renewable"},calls=[],{context,values}=createContext({initial,localAPI:async(_url,options)=>{calls.push(JSON.parse(options.body));return {session:session()};}});
 values.set("cineva.supabase.session",JSON.stringify(initial));await context.refreshSession();assert.equal(calls[0].refresh_token,"legacy-renewable");assert.equal(values.get("cineva.supabase.session").includes("legacy-renewable"),false);assert.equal(values.get("cineva.supabase.session").includes("memory-access-"),false);await context.refreshSession();assert.deepEqual(calls[1],{});
});
test("a failed legacy migration leaves its existing secret untouched until it can be exchanged",async()=>{
 const initial={...session(),cookie_session:false,refresh_token:"legacy-offline"}, {context,values}=createContext({initial,localAPI:async()=>{throw Error("Offline");}});values.set("cineva.supabase.session",JSON.stringify(initial));await assert.rejects(context.refreshSession(),/Offline/);assert.equal(JSON.parse(values.get("cineva.supabase.session")).refresh_token,"legacy-offline");
});
test("late refresh completion cannot resurrect a locally signed-out session",async()=>{
 let release;const gate=new Promise(done=>release=done),{context,state,values}=createContext({localAPI:async()=>{await gate;return {session:session()};}});const request=context.refreshSession();context.clearSession();release();await assert.rejects(request,/Account changed/);assert.equal(state.session,null);assert.equal(values.has("cineva.supabase.session"),false);
});
test("newer cache metadata is not a bearer token and cannot replace the in-memory credential",async()=>{
 const {context,state,values}=createContext();values.set("cineva.supabase.session",JSON.stringify({...session(),access_token:undefined,expires_at:Math.floor(Date.now()/1000)+7200}));await context.refreshSession();assert.equal(state.session.access_token,"memory-access-member-1");assert.equal(values.get("cineva.supabase.session").includes("access_token"),false);
});
test('a pending offline logout prevents refresh from reactivating the account',async()=>{let calls=0;const {context,values}=createContext({localAPI:async()=>{calls++;return {session:session()};}});values.set('seven.auth.logout.pending',String(Date.now()));await assert.rejects(context.refreshSession(),error=>error.status===401);assert.equal(calls,0);});
