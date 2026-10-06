const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const watchlistSql = fs.readFileSync(path.join(web, "supabase-watchlist.sql"), "utf8");
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

test("Watchlist is one row per signed-in account and has owner-only RLS", () => {
  assert.match(watchlistSql, /user_id uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/);
  assert.match(watchlistSql, /primary key \(user_id, content_type, tmdb_id\)/);
  assert.match(watchlistSql, /alter table public\.account_watchlist enable row level security/);
  assert.match(watchlistSql, /to authenticated[\s\S]*?\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id[\s\S]*?with check \(\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id\)/);
  assert.match(watchlistSql, /as restrictive for all to authenticated[\s\S]*?\(select \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) is false[\s\S]*?with check \(\(select \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) is false\)/);
  assert.doesNotMatch(watchlistSql, /profile_id/);
});

test("guests, unsupported methods, and invalid items cannot access or mutate Watchlist", async () => {
  const originalFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; return new Response("[]", { status:200 }); };
  try {
    assert.equal((await request("GET", { token:null })).status, 401);
    assert.equal((await request("PUT")).status, 405);
    const badType = await request("POST", { body:{ content_type:"person", tmdb_id:12 } });
    assert.equal(badType.status, 400);
    const badId = await request("DELETE", { query:"?type=movie&id=-2" });
    assert.equal(badId.status, 400);
    assert.equal(fetches, 0);
  } finally { global.fetch = originalFetch; }
});

test("authenticated Watchlist requests are account-scoped, idempotent, and never accept a profile id", async () => {
  const originalFetch = global.fetch, calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url:String(url), options });
    return new Response(JSON.stringify([{ content_type:"tv", tmdb_id:812, title:"Example series" }]), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    const added = await request("POST", { body:{ content_type:"tv", tmdb_id:812, title:"Example series", release_date:"2026-09-18", vote_average:8.3, profile_id:"another-profile", user_id:"another-user" } });
    assert.equal(added.status, 200);
    const payload = JSON.parse(calls[0].options.body);
    assert.equal(calls[0].options.headers.Authorization, "Bearer test-user-token");
    assert.match(calls[0].url, /account_watchlist\?on_conflict=user_id,content_type,tmdb_id$/);
    assert.equal(calls[0].options.headers.Prefer, "resolution=merge-duplicates,return=representation");
    assert.equal(payload.content_type, "tv");
    assert.equal(payload.tmdb_id, 812);
    assert.equal("user_id" in payload, false);
    assert.equal("profile_id" in payload, false);

    await request("GET");
    assert.match(calls[1].url, /account_watchlist\?select=\*&order=added_at\.desc$/);
    assert.doesNotMatch(calls[1].url, /profile_id/);

    await request("DELETE", { query:"?type=tv&id=812" });
    assert.match(calls[2].url, /account_watchlist\?content_type=eq\.tv&tmdb_id=eq\.812$/);
  } finally { global.fetch = originalFetch; }
});

test("mobile keeps five slots by combining Movies and Series under Browse", () => {
  assert.match(app, /data-mobile-browse/);
  assert.match(app, /data-catalog-type="movie"/);
  assert.match(app, /data-catalog-type="tv"/);
  assert.match(app, /data-favourites/);
  assert.match(app, /data-watchlist/);
});

test("the client does not persist guest lists and isolates Watchlist cache by account", () => {
  assert.match(app, /function accountWatchlistUserId\(\)[\s\S]*?!state\.session\?\.access_token[\s\S]*?is_anonymous/);
  assert.match(app, /function watchlistStorageKey\(userId = accountWatchlistUserId\(\)\)[\s\S]*?WATCHLIST_STORAGE_PREFIX\}\$\{userId\}/);
  assert.match(app, /function persistWatchlist\(\)[\s\S]*?if \(!ownerId \|\| state\.watchlistOwnerId !== ownerId\) return/);
  assert.match(app, /if \(!ownerId\) \{ showAuth\("login", "Sign in to save titles to a Watchlist that follows your account\."\); return; \}/);
  assert.match(app, /data-watchlist-retry/);
  assert.match(app, /data-watchlist-remove/);
});
