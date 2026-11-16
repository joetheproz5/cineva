const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const hero = require("../hero-spotlight.js");

const web = path.resolve(__dirname, "..");

test("textless hero art uses the highest-rated null-language poster at the same ratio", () => {
  const posters = [
    { file_path:"/regular.jpg", iso_639_1:"en", width:1000, height:1500, vote_average:8.1 },
    { file_path:"/lower-rated.jpg", iso_639_1:null, width:1000, height:1500, vote_average:6.4, vote_count:40 },
    { file_path:"/best.jpg", iso_639_1:null, width:1000, height:1500, vote_average:8.8, vote_count:20 },
    { file_path:"/wrong-ratio.jpg", iso_639_1:null, width:1000, height:1000, vote_average:9.9, vote_count:100 },
    { file_path:"/translated.jpg", iso_639_1:"fr", width:1000, height:1500, vote_average:10, vote_count:100 }
  ];
  assert.equal(hero.chooseTextlessPoster(posters,"/regular.jpg"),"/best.jpg");
  assert.equal(hero.chooseTextlessPoster(posters.filter(image => image.iso_639_1 == null),"/regular.jpg"),"/best.jpg","null-language-only responses still match standard 2:3 posters");
  assert.equal(hero.chooseTextlessPoster(posters,"/missing.jpg"),"/best.jpg","the regular poster path need not appear in a null-language-only response");
});

test("textless image metadata uses the existing proxy and is cached for this session", async () => {
  const calls = [];
  const loader = hero.createTextlessPosterLoader({ fetchImpl:async (url, options) => {
    calls.push({ url, options });
    return { ok:true, json:async () => ({ posters:[
      { file_path:"/normal.jpg", iso_639_1:"en", width:1000, height:1500 },
      { file_path:"/clean.jpg", iso_639_1:null, width:1000, height:1500, vote_average:8.9 }
    ] }) };
  }});
  const movie = { type:"movie", id:157336, poster_path:"/normal.jpg" };
  assert.equal(await loader.load(movie),"/clean.jpg");
  assert.equal(await loader.load(movie),"/clean.jpg");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"/api/tmdb/movie/157336/images?include_image_language=null");
  assert.equal(calls[0].options.credentials,"same-origin");
  assert.equal(await loader.load({ type:"tv", id:1396 }),null);
  assert.equal(calls.length,1,"a title without a poster does not make an images request");
});

test("the helper only warms the two visible carousel positions and keeps the swap time bounded", () => {
  const source = fs.readFileSync(path.join(web,"hero-spotlight.js"),"utf8");
  assert.match(source,/pool\.slice\(0, 2\)[\s\S]*?warmTextlessPoster\(item\)/);
  assert.match(source,/warmTextlessPoster\(next\)/);
  assert.match(source,/const deadline = performance\.now\(\) \+ 1500/);
  assert.match(source,/slide\.classList\.add\("phone-poster-textless-loaded"\)/);
  assert.match(source,/phone-poster-textless-already/);
  assert.match(source,/slide\.classList\.add\("phone-poster-no-textless"\)/);
});

test("the hero can request image metadata through the existing TMDB token proxy", async () => {
  const route = path.resolve(__dirname,"../../functions/api/[[path]].js"), { onRequest } = await import(pathToFileURL(route).href);
  const source = fs.readFileSync(route,"utf8"), expression = source.match(/const tmdbAllowed = (\/.*\/);/)[1], allowed = Function(`return ${expression}`)();
  const originalFetch = global.fetch, calls = [];
  global.fetch = async url => { calls.push(String(url)); return Response.json({ posters:[{ file_path:"/textless.jpg", iso_639_1:null }] }); };
  try {
    const endpoint = "movie/157336/images", request = new Request(`https://seven.example/api/tmdb/${endpoint}?include_image_language=null`);
    const response = await onRequest({ request, env:{ TMDB_BEARER_TOKEN:"fixture-token" }, params:{ path:`tmdb/${endpoint}` } });
    assert.equal(response.status,200);assert.equal((await response.json()).posters[0].file_path,"/textless.jpg");
    assert.deepEqual(calls,["https://api.themoviedb.org/3/movie/157336/images?include_image_language=null"]);
    assert.equal(allowed.test("movie/157336/images"),true);assert.equal(allowed.test("tv/1396/images"),true);assert.equal(allowed.test("movie/157336/unlisted-images"),false);
  } finally { global.fetch = originalFetch; }
});
