const assert = require("node:assert/strict");
const test = require("node:test");
const search = require("../search-engine");
const title = (id, values = {}) => ({ id, media_type:"movie", title:`Title ${id}`, genre_ids:[28], release_date:"2026-01-01", original_language:"en", ...values });
const payload = (results, total_pages = 1) => ({ results, total_pages });
const person = (id, name, department) => ({ id, name, media_type:"person", known_for_department:department });

test("search paginates 20 at a time, removes duplicate credits/titles and keeps movie/series IDs separate", async () => {
  const view = search.create("Title"), calls = [];
  const api = async (_, params) => { calls.push(params.page); return payload(Array.from({length:20},(_,i)=>title((params.page-1)*20+i+1)),3); };
  await search.load(view,api); assert.equal(view.items.length,20); assert.equal(view.exhausted,false);
  await search.load(view,api,()=>true,()=>true,true); assert.equal(view.items.length,40);
  await search.load(view,api,()=>true,()=>true,true); assert.equal(view.items.length,60); assert.equal(view.exhausted,true); assert.deepEqual(calls,[1,2,3]);
});
test("actors load cast credits; directors only load Director jobs, not writing or producing", async () => {
  for (const [name,department,expected] of [["Tom Hanks","Acting",[1,2]],["Christopher Nolan","Directing",[3]]]) {
    const view = search.create(name);
    const api = async path => path === "search/multi" ? payload([person(10,name,department)]) : {cast:[title(1),title(1),title(2,{media_type:"tv",name:"Show",title:undefined})],crew:[title(3,{job:"Director"}),title(4,{job:"Writer"}),title(5,{job:"Producer"})]};
    await search.load(view,api); assert.equal(view.person.name,name); assert.deepEqual(view.items.map(item=>item.id),expected);
  }
});
test("title mode avoids automatically selecting a person and people can be selected explicitly", async () => {
  const view = search.create("Nolan",[],{scope:"titles"}), candidate = person(2,"Christopher Nolan","Directing");
  const api = async path => path === "search/multi" ? payload([candidate,title(1)]) : {crew:[title(3,{job:"Director"})]};
  await search.load(view,api); assert.equal(view.person,null); assert.equal(view.items[0].id,1);
  const next = search.configure(view,{scope:"director"},candidate); await search.load(next,api); assert.equal(next.items[0].id,3);
});
test("exact title wins over an identically named person", async () => {
  const view = search.create("Taylor"), api = async () => payload([title(1,{title:"Taylor"}),person(2,"Taylor","Acting")]);
  await search.load(view,api); assert.equal(view.person,null); assert.equal(view.items.length,1);
});
test("typo correction uses a close catalog title and labels the corrected query", async () => {
  const view = search.create("interstelar",[title(1,{title:"Interstellar"})]), calls = [];
  await search.load(view,async(_,params)=>{calls.push(params.query);return payload(params.query === "Interstellar" ? [title(1,{title:"Interstellar"})] : []);});
  assert.equal(view.correction,"Interstellar"); assert.equal(view.items.length,1); assert.deepEqual(calls,["interstelar","Interstellar"]);
});
test("prefix fallback verifies spelling before returning candidates and never floods unrelated results", async () => {
  const view = search.create("interstelar");
  await search.load(view,async(_,params)=>payload(params.query === "inters" ? [title(1,{title:"Interstellar"}),title(2,{title:"Interstate"})] : params.query === "Interstellar" ? [title(1,{title:"Interstellar"})] : []));
  assert.equal(view.correction,"Interstellar"); assert.equal(view.items.length,1);
  const unknown = search.create("zzzzzzzzz"); await search.load(unknown,async()=>payload([].concat([])));
  assert.equal(unknown.items.length,0); assert.equal(unknown.correction,"");
  assert.ok(search.similarity("Amélie","amelie") === 1);
});
test("filters use original language, semantic TV genre, exact year and profile restrictions on all pages", async () => {
  const view = search.create("Title",[],{type:"tv",genre:"28:10759",year:"2026",language:"ar"});
  await search.load(view,async(_,params)=>payload(params.page===1 ? [title(1),title(2,{media_type:"tv",title:undefined,name:"Show",genre_ids:[10759],first_air_date:"2026-05-01",release_date:undefined,original_language:"ar"})] : [title(3,{media_type:"tv",genre_ids:[10759],original_language:"ar"})],2),item=>item.id!==3);
  assert.deepEqual(view.items.map(item=>item.id),[2]); assert.equal(view.page,2);
  const reset = search.configure(view,search.defaults); await search.load(reset,async()=>{throw Error("should use existing pages");}); assert.equal(reset.items.length,3);
});
test("rare filtered searches are bounded, can keep looking, and do not falsely claim exhaustion", async () => {
  const view = search.create("Title",[],{language:"ar"}); let calls = 0;
  await search.load(view,async(_,params)=>{calls++;return payload([title(params.page)],30);});
  assert.equal(calls,6); assert.equal(view.items.length,0); assert.equal(view.exhausted,false);
});
test("more failure keeps old results, retry uses the same page, and duplicate loads do not race", async () => {
  const view=search.create("Title");let fail=true,calls=[];
  const api=async(_,params)=>{calls.push(params.page);if(params.page===2&&fail){fail=false;throw Error("Offline");}return payload(Array.from({length:20},(_,i)=>title((params.page-1)*20+i+1)),2);};
  await search.load(view,api); await search.load(view,api,()=>true,()=>true,true); assert.equal(view.items.length,20); assert.equal(view.error,"Offline"); assert.equal(view.page,1);
  await Promise.all([search.load(view,api,()=>true,()=>true,true),search.load(view,api,()=>true,()=>true,true)]);
  assert.equal(view.items.length,40); assert.deepEqual(calls,[1,2,2]);
});
test("stale searches never publish a result after changing query or profile", async () => {
  const view=search.create("Old query");let current=true;
  await search.load(view,async()=>{current=false;return payload([title(1)]);},()=>true,()=>current);
  assert.equal(view.items.length,0);assert.equal(view.loading,false);
});
test("credits errors are retryable and no subset is misrepresented as the full filmography", async () => {
  const view=search.create("Tom Hanks");let fail=true;
  const api=async path=>{if(path==="search/multi")return payload([person(1,"Tom Hanks","Acting")]);if(fail){fail=false;throw Error("Unavailable");}return {cast:[title(2)]};};
  await search.load(view,api);assert.equal(view.items.length,0);assert.equal(view.error,"Unavailable");
  await search.load(view,api);assert.equal(view.error,"");assert.equal(view.items[0].id,2);
});
test("a valid obscure spelling stays available with an optional better-known alternative", async () => {
  const view=search.create("interstelar");
  await search.load(view,async(_,params)=>payload(params.query==="interstelar" ? [title(1,{title:"Interstelar",popularity:1})] : [title(2,{title:"Interstellar",popularity:80})]));
  assert.equal(view.correction,"");assert.equal(view.suggestion,"Interstellar");assert.equal(view.items[0].id,1);
});
test("acting roles rank ahead of popular talk shows and acting/directing roles can be changed", async () => {
  const view=search.create("Tom Hanks"),api=async path=>path==="search/multi" ? payload([person(1,"Tom Hanks","Acting")]) : {cast:[title(2,{popularity:80,character:"Self"}),title(3,{popularity:20,character:"Forrest Gump"})],crew:[title(4,{job:"Director"})]};
  await search.load(view,api);assert.equal(view.items[0].id,3);
  const next=search.configure(view,{scope:"director"});await search.load(next,api);assert.deepEqual(next.items.map(item=>item.id),[4]);
});
