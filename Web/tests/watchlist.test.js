const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const watchlistSql = fs.readFileSync(path.join(web, "supabase-watchlist.sql"), "utf8");
const watchlistMigration = fs.readFileSync(path.join(web, "supabase-watchlist-profile-scope.sql"), "utf8");
const apiFile = path.resolve(web, "..", "functions", "api", "[[path]].js");
let onRequestPromise;
function route() { return onRequestPromise ||= import(require("node:url").pathToFileURL(apiFile).href).then(module => module.onRequest); }

async function request(method, { token = "test-user-token", body, query = "", env = { SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test" } } = {}) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const request = new Request(`https://seven.test/api/account/watchlist${query}`, { method, headers, ...(body !== undefined ? { body:JSON.stringify(body) } : {}) });
  const original=global.fetch;global.fetch=require("./security-fixture.cjs").wrap(original);try{return await (await route())({ request, params:{ path:"account/watchlist" }, env });}finally{global.fetch=original;}
}

test("Watchlist rows are unique per profile with owner-only, permanent-account RLS", () => {
  assert.match(watchlistSql, /user_id uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/);
  assert.match(watchlistSql, /profile_id text not null default 'main'/);
  assert.match(watchlistSql, /primary key \(user_id, profile_id, content_type, tmdb_id\)/);
  assert.match(watchlistSql, /alter table public\.profile_watchlist enable row level security/);
  assert.match(watchlistSql, /to authenticated[\s\S]*?\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id[\s\S]*?with check \(\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id\)/);
  assert.match(watchlistSql, /as restrictive for all to authenticated[\s\S]*?\(\(select auth\.jwt\(\)\) ->> 'is_anonymous'\)::boolean is false[\s\S]*?with check \(\(\(select auth\.jwt\(\)\) ->> 'is_anonymous'\)::boolean is false\)/);
  assert.match(watchlistMigration, /rename to profile_watchlist/);
  assert.match(watchlistMigration, /default 'main'/);
  assert.match(watchlistMigration, /primary key \(user_id, profile_id, content_type, tmdb_id\)/);
});

test("guests, unsupported methods, missing profiles, and invalid titles cannot access or mutate Watchlist", async () => {
  const originalFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; return new Response("[]", { status:200 }); };
  try {
    assert.equal((await request("GET", { token:null })).status, 401);
    assert.equal((await request("PUT")).status, 405);
    assert.equal((await request("GET", { query:"" })).status, 400);
    const badType = await request("POST", { body:{ profile_id:"main", content_type:"person", tmdb_id:12 } });
    assert.equal(badType.status, 400);
    const missingProfile = await request("POST", { body:{ content_type:"movie", tmdb_id:12 } });
    assert.equal(missingProfile.status, 400);
    const badProfile = await request("GET", { query:"?profile=../../other" });
    assert.equal(badProfile.status, 400);
    const badId = await request("DELETE", { query:"?profile=main&type=movie&id=-2" });
    assert.equal(badId.status, 400);
    assert.equal(fetches, 0);
  } finally { global.fetch = originalFetch; }
});

test("authenticated Watchlist requests are scoped to one profile", async () => {
  const originalFetch = global.fetch, calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url:String(url), options });
    return new Response(JSON.stringify([{ content_type:"tv", tmdb_id:812, title:"Example series" }]), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    const added = await request("POST", { body:{ profile_id:"profile-123", content_type:"tv", tmdb_id:812, title:"Example series", release_date:"2026-09-18", vote_average:8.3, user_id:"another-user" } });
    assert.equal(added.status, 200);
    const payload = JSON.parse(calls[0].options.body);
    assert.equal(calls[0].options.headers.Authorization, "Bearer test-user-token");
    assert.match(calls[0].url, /profile_watchlist\?on_conflict=user_id,profile_id,content_type,tmdb_id$/);
    assert.equal(calls[0].options.headers.Prefer, "resolution=merge-duplicates,return=representation");
    assert.equal(payload.content_type, "tv");
    assert.equal(payload.tmdb_id, 812);
    assert.equal(payload.profile_id, "profile-123");
    assert.equal("user_id" in payload, false);

    await request("GET", { query:"?profile=profile-123" });
    assert.match(calls[1].url, /profile_watchlist\?select=\*&profile_id=eq\.profile-123&order=added_at\.desc$/);

    await request("DELETE", { query:"?profile=profile-123&type=tv&id=812" });
    assert.match(calls[2].url, /profile_watchlist\?profile_id=eq\.profile-123&content_type=eq\.tv&tmdb_id=eq\.812$/);

    await request("DELETE", { query:"?profile=profile-123&all=true" });
    assert.match(calls[3].url, /profile_watchlist\?profile_id=eq\.profile-123$/);
  } finally { global.fetch = originalFetch; }
});

test("successful Watchlist removals preserve the empty 204 response instead of throwing a JSON-body error", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(null, { status:204 });
  try {
    const removed = await request("DELETE", { query:"?profile=main&type=movie&id=12" });
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), "");
    const cleared = await request("DELETE", { query:"?profile=main&all=true" });
    assert.equal(cleared.status, 204);
    assert.equal(await cleared.text(), "");
  } finally { global.fetch = originalFetch; }
});
test('Undo can restore the original list date, but malformed/future dates are rejected',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options={})=>{calls.push({url,options});return Response.json([]);};
 try{for(const list of ['watchlist','list']){const headers={Authorization:'Bearer test','Content-Type':'application/json'},body={profile_id:'main',content_type:'movie',tmdb_id:12,title:'Film',added_at:'2020-01-01T00:00:00.000Z'};
  const run=added_at=>(route()).then(handler=>handler({request:new Request('https://seven.test/api/account/'+list,{method:'POST',headers,body:JSON.stringify({...body,added_at})}),params:{path:'account/'+list},env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture'}}));
  assert.equal((await run(body.added_at)).status,200);assert.equal(JSON.parse(calls.at(-1).options.body).added_at,body.added_at);
  for(const invalid of ['not-a-date','2999-01-01T00:00:00.000Z',123])assert.equal((await run(invalid)).status,400);
 }}finally{global.fetch=original;}
});

test("mobile keeps five slots by combining Movies and Series under Browse", () => {
  assert.match(app, /data-mobile-browse/);
  assert.match(app, /data-catalog-type="movie"/);
  assert.match(app, /data-catalog-type="tv"/);
  assert.match(app, /data-favourites/);
  assert.match(app, /data-watchlist/);
});

test("Watchlist caches and requests are scoped to the active account profile", () => {
  assert.match(app, /function accountWatchlistUserId\(\)[\s\S]*?!state\.session\?\.access_token[\s\S]*?is_anonymous/);
  assert.match(app, /PROFILE_WATCHLIST_STORAGE_PREFIX\}\$\{userId\}\.\$\{profileId\}/);
  assert.match(app, /state\.watchlistProfileId !== profileId/);
  assert.match(app, /profile=\$\{encodeURIComponent\(profileId\)\}/);
  assert.match(app, /profile_id:profileId/);
  assert.match(app, /if \(!ownerId\) \{ showAuth\("login", "Sign in to save titles to your profile’s Watchlist\."\); return; \}/);
  assert.match(app, /data-watchlist-retry/);
  assert.match(app, /data-watchlist-remove/);
  assert.match(app, /Your Watchlist is empty\./);
  assert.doesNotMatch(app, /Shared across every profile on your account/);
});

function watchlistUIContext(rows) {
  const buttons = ["movie:12", "movie:12", "tv:12", "movie:13"].map(key => ({
    dataset:{ toggleWatchlist:key }, attributes:{}, saved:false, text:{ textContent:"Watchlist" },
    classList:{ contains:() => false, toggle(name, value) { if (name === "saved") this.button.saved = value; } },
    setAttribute(name, value) { this.attributes[name] = value; }, querySelector() { return this.text; }
  }));
  buttons.forEach(button => { button.classList.button = button; });
  const state = { session:{ access_token:"test-token", user:{ id:"owner" } }, user:{ id:"owner" }, activeProfile:"one", route:"explore", watchlist:[], watchlistOwnerId:"owner", watchlistProfileId:"one", watchlistLoadSequence:0, watchlistMutationVersion:0, watchlistPending:new Set(), watchlistTargets:new Map() };
  const storage = new Map();
  const context = vm.createContext({ state, buttons, PROFILE_WATCHLIST_STORAGE_PREFIX:"test.", WATCHLIST_STORAGE_PREFIX:"old.", activeProfileId:() => state.activeProfile, authorizedHeaders:() => ({}), localAPI:async () => rows,
    localStorage:{ getItem:key => storage.get(key) || null, setItem:(key, value) => storage.set(key, value), removeItem:key => storage.delete(key) },
    document:{ querySelectorAll:() => buttons }, contentType:item => item.name ? "tv" : "movie", render:() => { throw Error("The grid must stay mounted"); }, titleOf:item => item.title || item.name || "Title"
  });
  const identity = app.match(/function savedTitleIdentity\([^\n]+/)[0];
  const helpers = app.slice(app.indexOf("function accountWatchlistUserId()"), app.indexOf("async function toggleWatchlist("));
  vm.runInContext(`${identity}\n${helpers}`, context);
  return { context, state, buttons };
}

test("background Watchlist sync updates every visible copy and detail label without redrawing the grid", async () => {
  const { context, buttons } = watchlistUIContext([{ content_type:"movie", tmdb_id:12, title:"Saved title" }]);
  await context.loadAccountWatchlist(false);
  assert.equal(buttons[0].saved, true); assert.equal(buttons[1].saved, true);
  assert.equal(buttons[0].attributes["aria-pressed"], "true"); assert.equal(buttons[1].text.textContent, "Saved");
  assert.equal(buttons[2].saved, false); assert.equal(buttons[3].saved, false);
});

test("the same saved title matches normalized cards, search results and database rows", () => {
  const { context, state } = watchlistUIContext([]);
  state.watchlist = [{ type:"movie", id:12 }];
  assert.equal(context.isInWatchlist({ type:"movie", id:"12" }), true);
  assert.equal(context.isInWatchlist({ media_type:"movie", id:12 }), true);
  assert.equal(context.isInWatchlist({ content_type:"movie", tmdb_id:"12" }), true);
  assert.equal(context.isInWatchlist({ type:"tv", id:12 }), false);
  state.activeProfile = "two";
  assert.equal(context.isInWatchlist({ type:"movie", id:12 }), false);
});

test("a slow sync for the previous profile cannot alter the new profile's bookmarks", async () => {
  let resolve;
  const { context, state, buttons } = watchlistUIContext([]);
  context.localAPI = () => new Promise(done => { resolve = done; });
  const pending = context.loadAccountWatchlist(false);
  state.activeProfile = "two";
  resolve([{ content_type:"movie", tmdb_id:12 }]); await pending;
  assert.equal(state.watchlist.length, 0); assert.ok(buttons.every(button => !button.saved));
});
