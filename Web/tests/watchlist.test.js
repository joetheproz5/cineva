const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  return (await route())({ request, params:{ path:"account/watchlist" }, env });
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
