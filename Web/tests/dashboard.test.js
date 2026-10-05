const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const dashboardPage = fs.readFileSync(path.join(repository, "Web/dashboard.html"), "utf8");
const pagesRedirects = fs.existsSync(path.join(repository, "Web/_redirects")) ? fs.readFileSync(path.join(repository, "Web/_redirects"), "utf8") : "";
const dashboardHeaders = fs.readFileSync(path.join(repository, "Web/_headers"), "utf8");
const localServer = fs.readFileSync(path.join(repository, "Web/server.js"), "utf8");
const metricsClient = fs.readFileSync(path.join(repository, "Web/metrics.js"), "utf8");
const metricsSchema = fs.readFileSync(path.join(repository, "Web/supabase-dashboard.sql"), "utf8");
const entryPage = fs.readFileSync(path.join(repository, "Web/index.html"), "utf8");
const downloadPage = fs.readFileSync(path.join(repository, "Web/download.html"), "utf8");
const functions = fs.readFileSync(path.join(repository, "functions/api/[[path]].js"), "utf8");

let handleDashboardRequest;
async function handler() {
  if (!handleDashboardRequest) handleDashboardRequest = (await import(pathToFileURL(path.join(repository, "shared/admin-dashboard.mjs")).href)).handleDashboardRequest;
  return handleDashboardRequest;
}

function adminEnv(overrides = {}) {
  return {
    SEVEN_ADMIN_PASSWORD:"a purposely long test passphrase",
    SEVEN_DASHBOARD_SECRET:"a-test-session-secret-that-is-long-enough",
    SUPABASE_URL:"https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
    SUPABASE_SECRET_KEY:"sb_secret_test_only",
    ...overrides
  };
}

function adminRequest(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method === "POST" && !headers.has("Origin")) headers.set("Origin", "https://seven.example");
  return new Request("https://seven.example" + pathname, { ...options, headers });
}

test("dashboard pages are private and account data stays on the admin-only accounts view", () => {
  assert.doesNotMatch(pagesRedirects, /^\/dashboard\s+\/dashboard\.html\s+200\s*$/m);
  assert.match(pagesRedirects, /^\/dashboard\/accounts\s+\/dashboard\.html\s+200\s*$/m);
  assert.match(dashboardHeaders, /\/dashboard\/accounts[\s\S]*?X-Robots-Tag: noindex, nofollow, noarchive/);
  assert.match(localServer, /"dashboard\/accounts\/"\]\.includes\(requested\)\) requested = "dashboard\.html"/);
  assert.match(dashboardPage, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(dashboardPage, /aria-label="Analytics date range"/);
  assert.match(dashboardPage, /Active users today/);
  assert.match(dashboardPage, /All-time user-days/);
  assert.match(dashboardPage, /id="guestsTodayValue"/);
  assert.match(dashboardPage, /id="accountsTodayValue"/);
  assert.match(dashboardPage, /id="allTimeGuestsValue"/);
  assert.match(dashboardPage, /id="allTimeAccountVisitorsValue"/);
  assert.match(dashboardPage, /Hours watched/);
  assert.match(dashboardPage, /id="hoursWatchedValue"/);
  assert.match(dashboardPage, /id="accountHoursValue"/);
  assert.match(dashboardPage, /id="guestHoursValue"/);
  assert.match(dashboardPage, /href="\/dashboard" data-dashboard-link="overview">Overview/);
  assert.match(dashboardPage, /href="\/dashboard\/accounts" data-dashboard-link="accounts">Accounts/);
  assert.match(dashboardPage, /id="overviewContent"/);
  assert.match(dashboardPage, /id="accountsContent" hidden/);
  assert.match(dashboardPage, /id="accountsTitle">Member accounts/);
  assert.match(dashboardPage, /id="accountSort"/);
  assert.match(dashboardPage, /Email<\/th><th scope="col">Hours watched/);
  assert.match(dashboardPage, /Guest account/);
  assert.match(dashboardPage, /id="guestAccountHours"/);
  assert.match(dashboardPage, /id="guestAccountToday"/);
  assert.match(dashboardPage, /id="guestAccountUserDays"/);
  assert.match(dashboardPage, /\/api\/admin\/accounts/);
  assert.match(dashboardPage, /nameCell\.textContent/);
  assert.match(dashboardPage, /emailCell\.textContent/);
  assert.doesNotMatch(dashboardPage, /account\.id|user_metadata|byTitle/);
  assert.match(dashboardPage, /Administrator sign in/);
  assert.doesNotMatch(dashboardPage, /The whole picture|Membership pulse|Install signal|Live · aggregate only|privacy-note|login-privacy/);
  assert.doesNotMatch(dashboardPage, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SEVEN_DASHBOARD_SECRET/);
  assert.match(dashboardPage, /autocomplete="current-password"/);
  assert.match(dashboardPage, /@media\(max-width:600px\)/);
});

test("browser metrics are daily, anonymous, and respect privacy signals", () => {
  assert.match(entryPage, /src="metrics\.js\?v=1"/);
  assert.match(downloadPage, /id="windowsBtn"[^>]*href="\/api\/install\/windows"/);
  assert.doesNotMatch(downloadPage, /trackDownload/);
  assert.match(metricsClient, /navigator\.doNotTrack === "1"/);
  assert.match(metricsClient, /navigator\.globalPrivacyControl === true/);
  assert.match(metricsClient, /saved\.day === today/);
  assert.match(metricsClient, /localStorage\.setItem\(storageKey/);
  assert.match(metricsClient, /keepalive:Boolean\(keepalive\)/);
  assert.match(metricsClient, /response\.ok/);
  assert.doesNotMatch(metricsClient, /navigator\.sendBeacon/);
  assert.doesNotMatch(metricsClient, /navigator\.userAgent|document\.cookie|email|playback_progress/);
});

test("analytics storage contains aggregates, locks raw visitor hashes, and limits RPC privileges", () => {
  assert.match(metricsSchema, /alter table public\.seven_admin_daily_metrics enable row level security/i);
  assert.match(metricsSchema, /alter table public\.seven_admin_visitor_hashes enable row level security/i);
  assert.match(metricsSchema, /delete from public\.seven_admin_visitor_hashes\s+where visitor_day < v_day - 30/i);
  assert.match(metricsSchema, /grant execute on function public\.seven_admin_get_stats\(integer\) to service_role/i);
  assert.match(metricsSchema, /create or replace function public\.seven_admin_get_accounts\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i);
  assert.match(metricsSchema, /revoke all on function public\.seven_admin_get_accounts\(\) from public, anon, authenticated, service_role/i);
  assert.match(metricsSchema, /grant execute on function public\.seven_admin_get_accounts\(\) to service_role/i);
  assert.match(metricsSchema, /'watchHours', numbered_accounts\.watch_hours/);
  assert.match(metricsSchema, /'titlesTracked', numbered_accounts\.titles_tracked/);
  assert.match(metricsSchema, /'email', numbered_accounts\.email/);
  assert.match(metricsSchema, /hoursWatched/);
  assert.match(metricsSchema, /watch_seconds_guest/);
  assert.match(metricsSchema, /watch_seconds_account/);
  assert.match(metricsSchema, /guest_visitors/);
  assert.match(metricsSchema, /account_visitors/);
  assert.match(metricsSchema, /seven_admin_record_watch_time/);
  assert.match(metricsSchema, /seven_admin_record_guest_watch_time/);
  assert.match(metricsSchema, /accountHoursWatched/);
  assert.match(metricsSchema, /guestHoursWatched/);
  assert.match(metricsSchema, /seven_admin_watch_events/);
  assert.match(metricsSchema, /event_id uuid primary key/i);
  assert.match(metricsSchema, /seven_admin_watch_baseline/);
  assert.match(metricsSchema, /from public\.playback_progress/);
  assert.match(metricsSchema, /on conflict \(singleton\) do nothing/i);
  assert.match(metricsSchema, /from auth\.users/i);
  assert.doesNotMatch(metricsSchema, /user_id|poster_path|content_key|title text/i);
  assert.match(functions, /path === "metrics\/event" \|\| path\.startsWith\("admin\/"\)/);
  assert.match(functions, /path === "account\/watch-time"/);
  assert.match(functions, /seven_admin_record_watch_time/);
  assert.match(fs.readFileSync(path.join(repository, "Web/app.js"), "utf8"), /samplePlaybackWatchTime\(currentTime\)/);
  assert.match(fs.readFileSync(path.join(repository, "Web/app.js"), "utf8"), /playbackWatch\.bufferType = userType/);
  assert.match(fs.readFileSync(path.join(repository, "Web/app.js"), "utf8"), /window\.addEventListener\("pagehide"/);
  assert.match(metricsClient, /trackAccountVisit:function/);
});

test("admin stats are server-authenticated and use only the service-side Supabase RPC", async () => {
  const run = await handler();
  const unauthorized = await run(adminRequest("/api/admin/stats"), adminEnv());
  assert.equal(unauthorized.status, 401);

  const login = await run(adminRequest("/api/admin/login", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ username:"admin", password:"a purposely long test passphrase" })
  }), adminEnv());
  assert.equal(login.status, 200);
  const cookieHeader = login.headers.get("set-cookie");
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /Secure/);
  assert.match(cookieHeader, /SameSite=Strict/);
  const cookie = cookieHeader.split(";")[0];

  const originalFetch = global.fetch;
  let rpcCalls = 0;
  global.fetch = async (url, options) => {
    rpcCalls += 1;
    assert.equal(url, "https://example.supabase.co/rest/v1/rpc/seven_admin_get_stats");
    assert.equal(options.headers.apikey, "sb_secret_test_only");
    assert.equal(options.headers.Authorization, undefined, "new secret API keys are not JWT bearer tokens");
    assert.deepEqual(JSON.parse(options.body), { p_days:7 });
    return Response.json({ totals:{ accounts:5 }, daily:[] });
  };
  try {
    const stats = await run(adminRequest("/api/admin/stats?days=7", { headers:{ Cookie:cookie } }), adminEnv());
    assert.equal(stats.status, 200);
    assert.deepEqual(await stats.json(), { totals:{ accounts:5 }, daily:[] });
    assert.equal(rpcCalls, 1);

    const legacyCalls = [];
    global.fetch = async (url, options) => {
      legacyCalls.push(options.headers);
      return Response.json({ totals:{ accounts:5 }, daily:[] });
    };
    const legacyStats = await run(adminRequest("/api/admin/stats", { headers:{ Cookie:cookie } }), adminEnv({
      SUPABASE_SECRET_KEY:undefined,
      SUPABASE_SERVICE_ROLE_KEY:"legacy-service-role-test"
    }));
    assert.equal(legacyStats.status, 200);
    assert.equal(legacyCalls[0].apikey, "legacy-service-role-test");
    assert.equal(legacyCalls[0].Authorization, "Bearer legacy-service-role-test");

    const logout = await run(adminRequest("/api/admin/logout", { method:"POST", headers:{ Cookie:cookie } }), adminEnv());
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("private account summaries require the admin session and call only the server-side RPC", async () => {
  const run = await handler();
  const unauthorized = await run(adminRequest("/api/admin/accounts"), adminEnv());
  assert.equal(unauthorized.status, 401);

  const login = await run(adminRequest("/api/admin/login", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ username:"admin", password:"a purposely long test passphrase" })
  }), adminEnv());
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ totalAccounts:1, accounts:[{ displayName:"Sample Member", email:"member@example.test", watchHours:4.5, titlesTracked:3, profileCount:2, longestStreak:5 }] });
  };
  try {
    const response = await run(adminRequest("/api/admin/accounts", { headers:{ Cookie:cookie } }), adminEnv());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { totalAccounts:1, accounts:[{ displayName:"Sample Member", email:"member@example.test", watchHours:4.5, titlesTracked:3, profileCount:2, longestStreak:5 }] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/seven_admin_get_accounts");
    assert.equal(calls[0].options.headers.apikey, "sb_secret_test_only");
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(calls[0].options.body), {});
    const method = await run(adminRequest("/api/admin/accounts", { method:"POST", headers:{ Cookie:cookie } }), adminEnv());
    assert.equal(method.status, 405);
  } finally {
    global.fetch = originalFetch;
  }
});

test("login rejects cross-origin attempts and visit tracking honors DNT without writing", async () => {
  const run = await handler();
  const crossOrigin = await run(adminRequest("/api/admin/login", {
    method:"POST",
    headers:{ Origin:"https://attacker.example", "Content-Type":"application/json" },
    body:JSON.stringify({ username:"admin", password:"a purposely long test passphrase" })
  }), adminEnv());
  assert.equal(crossOrigin.status, 403);

  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; return Response.json({}); };
  try {
    const optedOut = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", DNT:"1", "Content-Type":"text/plain" },
      body:JSON.stringify({ event:"visit", visitorId:"a".repeat(32) })
    }), adminEnv());
    assert.equal(optedOut.status, 204);
    assert.equal(calls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("platform install clicks are recorded server-side before redirects and still honor privacy signals", async () => {
  const route = await import(pathToFileURL(path.join(repository, "functions/api/[[path]].js")).href);
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, payload:JSON.parse(options.body) }); return Response.json(true); };
  try {
    const redirect = await route.onRequest({ request:new Request("https://seven.example/api/install/windows", { headers:{ "Sec-Fetch-Site":"same-origin" } }), env:adminEnv(), params:{ path:["install", "windows"] } });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "https://github.com/joetheproz5/cineva/releases/latest/download/SEVEN-Setup-win-x64.exe");
    assert.equal(redirect.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls, [{ url:"https://example.supabase.co/rest/v1/rpc/seven_admin_record_download", payload:{ p_platform:"windows" } }]);

    const optedOut = await route.onRequest({ request:new Request("https://seven.example/api/install/windows", { headers:{ "Sec-Fetch-Site":"same-origin", "Sec-GPC":"1" } }), env:adminEnv(), params:{ path:["install", "windows"] } });
    assert.equal(optedOut.status, 302);
    assert.equal(calls.length, 1);
    const head = await route.onRequest({ request:new Request("https://seven.example/api/install/windows", { method:"HEAD", headers:{ "Sec-Fetch-Site":"same-origin" } }), env:adminEnv(), params:{ path:["install", "windows"] } });
    assert.equal(head.status, 302);
    assert.equal(calls.length, 1, "link previews must not increment install clicks");
    const android = await route.onRequest({ request:new Request("https://seven.example/api/install/android", { headers:{ "Sec-Fetch-Site":"same-origin" } }), env:adminEnv(), params:{ path:["install", "android"] } });
    assert.equal(android.headers.get("location"), "https://seven.example/downloads/seven.apk");
    assert.deepEqual(calls[1].payload, { p_platform:"android" });
    const mac = await route.onRequest({ request:new Request("https://seven.example/api/install/mac", { headers:{ "Sec-Fetch-Site":"same-origin" } }), env:adminEnv(), params:{ path:["install", "mac"] } });
    assert.equal(mac.headers.get("location"), "https://github.com/joetheproz5/cineva/releases/latest/download/SEVEN-macOS.dmg");
    assert.deepEqual(calls[2].payload, { p_platform:"mac" });
    const ios = await route.onRequest({ request:new Request("https://seven.example/api/install/ios", { headers:{ "Sec-Fetch-Site":"same-origin" } }), env:adminEnv(), params:{ path:["install", "ios"] } });
    assert.equal(ios.headers.get("location"), "https://seven.example/");
    assert.deepEqual(calls[3].payload, { p_platform:"ios" });
    const unknown = await route.onRequest({ request:new Request("https://seven.example/api/install/nope"), env:adminEnv(), params:{ path:["install", "nope"] } });
    assert.equal(unknown.status, 404);
  } finally {
    global.fetch = originalFetch;
  }
});

test("visit, download, and guest watch events persist only validated aggregate RPC payloads", async () => {
  const run = await handler();
  const originalFetch = global.fetch;
  const rpcCalls = [];
  global.fetch = async (url, options) => {
    rpcCalls.push({ url, payload:JSON.parse(options.body) });
    return Response.json(true);
  };
  try {
    const visitId = "1234567890abcdef1234567890abcdef";
    const visit = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", "Content-Type":"text/plain" },
      body:JSON.stringify({ event:"visit", visitorId:visitId })
    }), adminEnv());
    const download = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", "Content-Type":"text/plain" },
      body:JSON.stringify({ event:"download", platform:"windows" })
    }), adminEnv());
    const watch = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", "Content-Type":"text/plain" },
      body:JSON.stringify({ event:"watch-time", eventId:"11111111-1111-4111-8111-111111111111", seconds:15 })
    }), adminEnv());
    assert.equal(visit.status, 204);
    assert.equal(download.status, 204);
    assert.equal(watch.status, 204);
    assert.equal(rpcCalls.length, 3);
    assert.match(rpcCalls[0].payload.p_fingerprint, /^[a-f0-9]{64}$/);
    assert.notEqual(rpcCalls[0].payload.p_fingerprint, visitId);
    assert.deepEqual(rpcCalls[0].payload, { p_fingerprint:rpcCalls[0].payload.p_fingerprint, p_visitor_type:"guest", p_guest_fingerprint:null });
    assert.deepEqual(rpcCalls[1].payload, { p_platform:"windows" });
    assert.match(rpcCalls[1].url, /seven_admin_record_download$/);
    assert.deepEqual(rpcCalls[2].payload, { p_event_id:"11111111-1111-4111-8111-111111111111", p_seconds:15 });
    assert.match(rpcCalls[2].url, /seven_admin_record_guest_watch_time$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("analytics write failures return a generic response and log only safe RPC diagnostics", async () => {
  const run = await handler();
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const logs = [];
  global.fetch = async () => Response.json({ code:"42501", message:"must not leak database details" }, { status:401 });
  console.error = (...args) => logs.push(args);
  try {
    const response = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", "Content-Type":"text/plain" },
      body:JSON.stringify({ event:"download", platform:"windows" })
    }), adminEnv());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error:"Analytics event could not be recorded." });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "seven_metrics_write_failed");
    assert.deepEqual(logs[0][1], { event:"download", rpc:"seven_admin_record_download", status:401, code:"42501" });
    assert.doesNotMatch(JSON.stringify(logs), /must not leak database details/);
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("account visits verify the session and store only daily HMAC fingerprints", async () => {
  const run = await handler();
  const originalFetch = global.fetch;
  const requests = [];
  const accountId = "12345678-1234-4123-8123-123456789abc";
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id:accountId });
    return Response.json(true);
  };
  try {
    const visitorId = "abcdef0123456789abcdef0123456789";
    const response = await run(adminRequest("/api/metrics/event", {
      method:"POST",
      headers:{ Origin:"https://seven.example", "Content-Type":"text/plain", Authorization:"Bearer valid-account-session" },
      body:JSON.stringify({ event:"visit", visitorId })
    }), adminEnv());
    assert.equal(response.status, 204);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "https://example.supabase.co/auth/v1/user");
    assert.equal(requests[0].options.headers.apikey, "sb_publishable_test");
    assert.equal(requests[0].options.headers.Authorization, "Bearer valid-account-session");
    const rpcPayload = JSON.parse(requests[1].options.body);
    assert.equal(rpcPayload.p_visitor_type, "account");
    assert.match(rpcPayload.p_fingerprint, /^[a-f0-9]{64}$/);
    assert.match(rpcPayload.p_guest_fingerprint, /^[a-f0-9]{64}$/);
    assert.notEqual(rpcPayload.p_fingerprint, accountId);
    assert.notEqual(rpcPayload.p_guest_fingerprint, visitorId);
    assert.match(requests[1].url, /seven_admin_record_visit$/);
  } finally {
    global.fetch = originalFetch;
  }
});
