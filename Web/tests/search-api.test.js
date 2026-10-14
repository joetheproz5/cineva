const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
test("the production proxy permits numeric combined credits but rejects arbitrary person subroutes", async () => {
  const { onRequest } = await import(pathToFileURL(path.resolve(__dirname,"../../functions/api/[[path]].js")).href);
  const originalFetch=global.fetch;const calls=[];
  global.fetch=async url=>{calls.push(String(url));return Response.json({cast:[{id:1}],crew:[]});};
  try {
    const request=async endpoint=>onRequest({request:new Request(`https://seven.example/api/tmdb/${endpoint}?language=en-US`),env:{TMDB_BEARER_TOKEN:"fixture-token"},params:{path:`tmdb/${endpoint}`}});
    const response=await request("person/31/combined_credits");assert.equal(response.status,200);assert.equal((await response.json()).cast[0].id,1);
    assert.equal((await request("person/31/arbitrary")).status,400);assert.equal((await request("person/not-an-id/combined_credits")).status,400);
    assert.deepEqual(calls,["https://api.themoviedb.org/3/person/31/combined_credits?language=en-US"]);
  } finally {global.fetch=originalFetch;}
  const server=fs.readFileSync(path.resolve(__dirname,"../server.js"),"utf8"),expression=server.match(/const tmdbAllowed = (\/.*\/);/)[1];
  const allowed=Function(`return ${expression}`)();assert.equal(allowed.test("person/31/combined_credits"),true);assert.equal(allowed.test("person/31/arbitrary"),false);
});
