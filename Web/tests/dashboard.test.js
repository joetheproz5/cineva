const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const dashboardPage = fs.readFileSync(path.join(repository, "Web/dashboard.html"), "utf8");
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
    SUPABASE_SECRET_KEY:"sb_secret_test_only",
    ...overrides
  };
}

function adminRequest(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method === "POST" && !headers.has("Origin")) headers.set("Origin", "https://seven.example");
  return new Request("https://seven.example" + pathname, { ...options, headers });
}

test("dashboard is private, responsive, and does not render member-level data", () => {
  assert.match(dashboardPage, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(dashboardPage, /aria-label="Analytics date range"/);
  assert.match(dashboardPage, /Unique browsers today/);
  assert.match(dashboardPage, /button clicks, not installs/);
  assert.match(dashboardPage, /titles watched, or playback history/);
  assert.doesNotMatch(dashboardPage, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SEVEN_DASHBOARD_SECRET/);
  assert.match(dashboardPage, /autocomplete="current-password"/);
  assert.match(dashboardPage, /@media\(max-width:600px\)/);
});

test("browser metrics are daily, anonymous, and respect privacy signals", () => {
  assert.match(entryPage, /src="metrics\.js\?v=1"/);
  assert.match(downloadPage, /SevenMetrics\?\.trackDownload\(entry\[1\]\)/);
  assert.match(metricsClient, /navigator\.doNotTrack === "1"/);
  assert.match(metricsClient, /navigator\.globalPrivacyControl === true/);
  assert.match(metricsClient, /saved\.day === today/);
  assert.match(metricsClient, /localStorage\.setItem\(storageKey/);
  assert.doesNotMatch(metricsClient, /navigator\.userAgent|document\.cookie|email|playback_progress/);
});

test("analytics storage contains aggregates, locks raw visitor hashes, and limits RPC privileges", () => {
  assert.match(metricsSchema, /alter table public\.seven_admin_daily_metrics enable row level security/i);
  assert.match(metricsSchema, /alter table public\.seven_admin_visitor_hashes enable row level security/i);
  assert.match(metricsSchema, /delete from public\.seven_admin_visitor_hashes\s+where visitor_day < v_day - 30/i);
  assert.match(metricsSchema, /grant execute on function public\.seven_admin_get_stats\(integer\) to service_role/i);
  assert.match(metricsSchema, /from auth\.users/i);
  assert.doesNotMatch(metricsSchema, /user_id|poster_path|content_key|title text/i);
  assert.match(functions, /path === "metrics\/event" \|\| path\.startsWith\("admin\/"\)/);
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

test("visit and download events persist only validated aggregate RPC payloads", async () => {
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
    assert.equal(visit.status, 204);
    assert.equal(download.status, 204);
    assert.equal(rpcCalls.length, 2);
    assert.match(rpcCalls[0].payload.p_fingerprint, /^[a-f0-9]{64}$/);
    assert.notEqual(rpcCalls[0].payload.p_fingerprint, visitId);
    assert.deepEqual(rpcCalls[1].payload, { p_platform:"windows" });
    assert.match(rpcCalls[1].url, /seven_admin_record_download$/);
  } finally {
    global.fetch = originalFetch;
  }
});
