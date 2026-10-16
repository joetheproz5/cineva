const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const model = require("../title-discovery.js");
const vm = require("node:vm");
const movie = (id, release_date = "2020-01-01", extra = {}) => ({ id, title:`Film ${id}`, release_date, ...extra });

test("collections use release order, stable ties, valid dates and unique movie identities", () => {
  const collection = { parts:[movie(8, ""), movie(3, "2023-01-01"), movie(1), movie(1), movie(2, "2020-01-01"), movie(6, "2024-02-30"), movie(9, "2021-01-01", { media_type:"tv" }), { id:0, title:"Invalid" }, { id:4 }] };
  assert.deepEqual(model.parts(collection).map(item => item.id), [1,2,3,6,8]);
  assert.equal(model.dateOf(movie(1, "2024-02-30")), "");
  assert.equal(model.dateOf(movie(1, "2024-02-29")), "2024-02-29");
  assert.equal(model.released(movie(1, "2026-10-16"), "2026-10-16"), true);
  assert.equal(model.released(movie(1, "2026-10-17"), "2026-10-16"), false);
  assert.equal(model.released(movie(1, ""), "2026-10-16"), false);
  assert.deepEqual(model.parts(collection, item => item.id !== 2).map(item => item.id), [1,3,6,8]);
});
test("collection progress is supplied by the current profile, with no private state in metadata", () => {
  const items = [movie(1),movie(2),movie(3,"2099-01-01"),movie(4,"")];
  const firstProfile = item => item.id === 1 ? { watched:true } : { currentTime:600,duration:3600 };
  const one = model.summary(items, firstProfile, "2026-10-16"), two = model.summary(items, () => ({}), "2026-10-16");
  assert.equal(one.watched,1); assert.equal(one.released,2); assert.equal(one.next.id,2);
  assert.equal(two.watched,0); assert.equal(two.next.id,1); assert.equal(two.complete,false);
  assert.equal(model.summary(items, () => ({watched:true}), "2026-10-16").complete,true);
  assert.equal(model.summary([items[2]], () => ({}), "2026-10-16").complete,false);
  assert.equal(items.some(item => "watched" in item),false);
});
test("newest-first ordering never brings undated titles ahead of known releases or mutates the collection", () => {
  const items = [movie(1),movie(2,"2023-01-01"),movie(3,"")];
  assert.deepEqual(model.order(items,true).map(item=>item.id),[2,1,3]);
  assert.deepEqual(items.map(item=>item.id),[1,2,3]);
});
test("progress handles partial, completed, malformed and manual watched records", () => {
  assert.deepEqual(model.progress(movie(1), () => ({ currentTime:30,duration:60 })), {watched:false,percent:50,seconds:30,resume:true});
  assert.equal(model.progress(movie(1), () => ({ progress:91 })).watched,true);
  assert.equal(model.progress(movie(1), () => ({ watched:true,currentTime:0 })).resume,false);
  assert.equal(model.progress(movie(1), () => ({ currentTime:-10,progress:-5 })).percent,0);
  assert.deepEqual(model.progress(movie(1), () => ({ currentTime:Infinity,progress:Infinity,duration:NaN })),{watched:false,percent:0,seconds:0,resume:false});
});
test("More like this excludes self, sequels, blocked titles, duplicates, other media and unreleased entries", () => {
  const items = [movie(1),movie(2),movie(3),movie(4),movie(4),movie(5,"2099-01-01"),movie(6,""),movie(7,"2020-01-01",{media_type:"tv"})];
  const related = model.related(items, {type:"movie",id:1,collection:[movie(2)],allowed:item => item.id !== 3,today:"2026-10-16"});
  assert.deepEqual(related.map(item => item.id),[4]);
  assert.deepEqual(model.related([{id:3,name:"Show",first_air_date:"2020-01-01",type:"Scripted"}],{type:"tv",id:4}).map(item=>item.type),["tv"]);
});
test("profile-filtered collections explain restrictions instead of disappearing or exposing hidden posters", () => {
  const source=fs.readFileSync(path.resolve(__dirname,"../title-discovery-ui.js"),"utf8");
  const functionSource=source.slice(source.indexOf("function preview(view)"),source.indexOf("function paintPreview(view)"));
  const collection={name:"Collection",parts:[movie(1),movie(2)]};
  const context={model:()=>model,visibleParts:()=>[],state:{user:{id:"fixture"}},t:text=>text,escapeHTML:text=>text,chevron:"",image:()=>"",readProgress:()=>({})};
  const preview=vm.runInNewContext(`(${functionSource.trim()})`,context);
  const hidden=preview({collection});assert.match(hidden,/franchise-unavailable/);assert.match(hidden,/content settings hide/);assert.match(hidden,/data-discovery-settings/);
  assert.doesNotMatch(hidden,/<img|data-open-franchise|Film 1|Film 2/);
  context.visibleParts=()=>[collection.parts[0]];
  assert.match(preview({collection}),/data-open-franchise/);
  assert.doesNotMatch(preview({collection:{...collection,parts:[movie(1)]}}),/data-open-franchise/);
  assert.match(source,/data-discovery-settings[^\n]*showAccount\(\)/);
});
test("public metadata requests coalesce, expire, isolate languages and retry failed requests", async () => {
  let calls=0,now=0,fail=false;
  const cache=model.createCache(async()=>{calls++;if(fail)throw Error("Offline");return {parts:[movie(calls)]};},{ttl:10,limit:2,now:()=>now});
  await Promise.all([cache.get("collection/1"),cache.get("collection/1")]);assert.equal(calls,1);
  await cache.get("collection/1",{},"Arabic");assert.equal(calls,2);
  now=11;await cache.get("collection/1");assert.equal(calls,3);
  fail=true;await assert.rejects(cache.get("collection/2"));fail=false;await cache.get("collection/2");assert.equal(calls,5);
  await cache.get("collection/3");await cache.get("collection/1");assert.equal(calls,7);
});
test("related loading coalesces double clicks and retries a failed source without skipping its page", async () => {
  const view=model.createRelated("movie",1),calls=[];let failure=true;
  const fetch=async(path,params)=>{calls.push([path,params.page]);if(path.endsWith("similar")&&failure)throw Error("Offline");return {results:[movie(params.page+1)],total_pages:2};};
  await Promise.all([model.loadRelated(view,fetch),model.loadRelated(view,fetch)]);
  assert.equal(calls.length,2);assert.deepEqual(view.errors,["similar"]);assert.equal(view.items.length,1);
  failure=false;await model.loadRelated(view,fetch);
  assert.deepEqual(calls.slice(2),[["movie/1/recommendations",2],["movie/1/similar",1]]);
  assert.deepEqual(view.items.map(item=>item.id),[2,3]);
  await model.loadRelated(view,fetch);assert.equal(view.sources.every(source=>source.done),true);
  assert.equal(view.errors.length,0);
});
test("both proxies allow only numeric collection and related endpoints", async () => {
  const {onRequest}=await import(pathToFileURL(path.resolve(__dirname,"../../functions/api/[[path]].js")).href);
  const originalFetch=global.fetch,calls=[];
  global.fetch=async url=>{calls.push(String(url));return Response.json({parts:[],results:[]});};
  const server=fs.readFileSync(path.resolve(__dirname,"../../functions/api/[[path]].js"),"utf8"),allowed=Function(`return ${server.match(/const tmdbAllowed = (\/.*\/);/)[1]}`)();
  try {
    for(const endpoint of ["collection/404609","movie/245891/similar","tv/1396/similar"]){
      const response=await onRequest({request:new Request(`https://seven.example/api/tmdb/${endpoint}`),env:{TMDB_BEARER_TOKEN:"fixture"},params:{path:`tmdb/${endpoint}`}});
      assert.equal(response.status,200);assert.equal(allowed.test(endpoint),true);
    }
    for(const endpoint of ["collection/nope","collection/1/images","collection/-1","collection/1/../2","movie/1/delete","movie/1/","tv/1/arbitrary"]){
      const response=await onRequest({request:new Request(`https://seven.example/api/tmdb/${endpoint}`),env:{TMDB_BEARER_TOKEN:"fixture"},params:{path:`tmdb/${endpoint}`}});
      assert.equal(response.status,400,endpoint);assert.equal(allowed.test(endpoint),false,endpoint);
    }
    assert.equal(calls.length,3);
  }finally{global.fetch=originalFetch;}
});
test("discovery hooks preserve title navigation, use profile-scoped progress and ship in the offline shell", () => {
  const web=path.resolve(__dirname,".."),app=fs.readFileSync(path.join(web,"app.js"),"utf8"),ui=fs.readFileSync(path.join(web,"title-discovery-ui.js"),"utf8"),index=fs.readFileSync(path.join(web,"index.html"),"utf8"),worker=fs.readFileSync(path.join(web,"service-worker.js"),"utf8");
  assert.match(app,/"titleDiscovery", "franchise"/);assert.match(app,/route === "franchise"\) return `\$\{route\}:\$\{state.franchise/);
  assert.match(ui,/view.scope === scope\(\)/);assert.match(ui,/state.titleDiscovery === view/);assert.match(ui,/savedProgress\(item\)/);
  assert.doesNotMatch(ui,/data-play|card-play|localStorage\.setItem/);
  for(const asset of ["title-discovery.js?v=1","title-discovery-ui.js?v=2","title-discovery.css?v=3"]){assert.ok(index.includes(asset));assert.ok(worker.includes(asset));}
  assert.ok(index.indexOf("title-discovery.js?v=1")<index.indexOf("title-discovery-ui.js?v=2"));
  assert.ok(index.indexOf("title-discovery-ui.js?v=2")<index.indexOf("app.js?v=381"));
});
test("collection filters reserve classic scrollbar space without changing startup or other pages",()=>{
  const css=fs.readFileSync(path.resolve(__dirname,'../title-discovery.css'),'utf8'),app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
  assert.match(css,/html.seven-collection-view \{ scrollbar-gutter: stable; \}/);
  assert.match(css,/@supports not \(scrollbar-gutter: stable\)[\s\S]*?html.seven-collection-view \{ overflow-y: scroll; \}/);
  assert.match(app,/classList.toggle\("seven-collection-view", state.route === "franchise"\)/);
});
