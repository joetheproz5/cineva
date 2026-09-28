const encoder = new TextEncoder();
const COOKIE_NAME = "seven_admin";
const SESSION_SECONDS = 6 * 60 * 60;
const DOWNLOAD_PLATFORMS = new Set(["mac", "ios", "windows", "android"]);

function json(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers:{ "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", ...headers } });
}

function adminUsername(env) {
  return env.SEVEN_ADMIN_USERNAME || "admin";
}

function configuredAdmin(env) {
  return Boolean(
    adminUsername(env).length <= 120 &&
    env.SEVEN_ADMIN_PASSWORD && env.SEVEN_ADMIN_PASSWORD.length >= 16 &&
    env.SEVEN_DASHBOARD_SECRET && env.SEVEN_DASHBOARD_SECRET.length >= 32
  );
}

function configuredSupabase(env) {
  return Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) mismatch |= (a[i] || 0) ^ (b[i] || 0);
  return mismatch === 0;
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function cookieValue(request) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === COOKIE_NAME) return part.slice(separator + 1).trim();
  }
  return "";
}

async function hasAdminSession(request, env) {
  if (!configuredAdmin(env)) return false;
  const [payload, signature, extra] = cookieValue(request).split(".");
  if (!payload || !signature || extra) return false;
  try {
    const expected = base64url(await sign(payload, env.SEVEN_DASHBOARD_SECRET));
    if (!constantTimeEqual(signature, expected)) return false;
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return session.user === adminUsername(env) && Number.isInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function originIsSame(request) {
  const requestURL = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return (!origin || origin === requestURL.origin) && fetchSite !== "cross-site";
}

async function readJSON(request, maximumBytes = 4096) {
  const text = await request.text();
  if (encoder.encode(text).byteLength > maximumBytes) throw new Error("Request is too large.");
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error("Invalid JSON."); }
}

function cookieHeaders(request, token, clear = false) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const maxAge = clear ? 0 : SESSION_SECONDS;
  const value = clear ? "" : token;
  return { "Set-Cookie":COOKIE_NAME + "=" + value + "; Path=/api/admin; Max-Age=" + maxAge + "; HttpOnly; SameSite=Strict" + secure };
}

async function supabaseRPC(env, functionName, payload) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + functionName, {
    method:"POST",
    headers:{ apikey:key, Authorization:"Bearer " + key, "Content-Type":"application/json", "Cache-Control":"no-store" },
    body:JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Analytics storage is unavailable.");
  return response.json();
}

async function login(request, env) {
  if (!originIsSame(request)) return json({ error:"Request origin rejected." }, 403);
  if (!configuredAdmin(env)) return json({ error:"Admin credentials are not configured. Set the SEVEN dashboard secrets in Cloudflare Pages." }, 503);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return json({ error:"JSON is required." }, 415);
  let body;
  try { body = await readJSON(request); }
  catch { return json({ error:"Enter a valid username and password." }, 400); }
  const username = typeof body.username === "string" ? body.username.slice(0, 120) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 1024) : "";
  if (!constantTimeEqual(username, adminUsername(env)) || !constantTimeEqual(password, env.SEVEN_ADMIN_PASSWORD)) return json({ error:"That username or password didn’t work." }, 401);

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const adminName = adminUsername(env);
  const payload = base64url(encoder.encode(JSON.stringify({ user:adminName, exp:expiresAt })));
  const token = payload + "." + base64url(await sign(payload, env.SEVEN_DASHBOARD_SECRET));
  return json({ ok:true, username:adminName }, 200, cookieHeaders(request, token));
}

async function recordMetric(request, env) {
  if (request.method !== "POST") return json({ error:"Method not allowed." }, 405, { Allow:"POST" });
  if (!originIsSame(request)) return json({ error:"Request origin rejected." }, 403);
  if (request.headers.get("DNT") === "1" || request.headers.get("Sec-GPC") === "1") return new Response(null, { status:204, headers:{ "Cache-Control":"no-store" } });
  if (!configuredSupabase(env)) return json({ error:"Analytics storage is not configured." }, 503);

  let body;
  try { body = await readJSON(request, 2048); }
  catch { return new Response(null, { status:204, headers:{ "Cache-Control":"no-store" } }); }
  try {
    if (body.event === "visit") {
      if (!configuredAdmin(env) || !/^[a-f0-9]{32}$/i.test(body.visitorId || "")) return new Response(null, { status:204, headers:{ "Cache-Control":"no-store" } });
      const day = new Date().toISOString().slice(0, 10);
      const signedFingerprint = await sign("visitor:v1:" + day + ":" + body.visitorId.toLowerCase(), env.SEVEN_DASHBOARD_SECRET);
      const fingerprint = [...signedFingerprint].map(byte => byte.toString(16).padStart(2, "0")).join("");
      await supabaseRPC(env, "seven_admin_record_visit", { p_fingerprint:fingerprint });
    } else if (body.event === "download" && DOWNLOAD_PLATFORMS.has(body.platform)) {
      await supabaseRPC(env, "seven_admin_record_download", { p_platform:body.platform });
    } else {
      return new Response(null, { status:204, headers:{ "Cache-Control":"no-store" } });
    }
    return new Response(null, { status:204, headers:{ "Cache-Control":"no-store" } });
  } catch { return json({ error:"Analytics event could not be recorded." }, 503); }
}

async function stats(request, env) {
  if (!await hasAdminSession(request, env)) return json({ error:"Admin sign-in required." }, 401);
  if (!configuredSupabase(env)) return json({ error:"Add the server-side Supabase secret and run the dashboard SQL setup." }, 503);
  const url = new URL(request.url);
  const days = url.searchParams.get("days") === "7" ? 7 : 30;
  try {
    const data = await supabaseRPC(env, "seven_admin_get_stats", { p_days:days });
    return json(data);
  } catch { return json({ error:"Couldn’t load the aggregate analytics right now." }, 502); }
}

export async function handleDashboardRequest(request, env = {}) {
  const path = new URL(request.url).pathname;
  if (path === "/api/metrics/event") return recordMetric(request, env);
  if (path === "/api/admin/login") return request.method === "POST" ? login(request, env) : json({ error:"Method not allowed." }, 405, { Allow:"POST" });
  if (path === "/api/admin/logout") {
    if (request.method !== "POST") return json({ error:"Method not allowed." }, 405, { Allow:"POST" });
    if (!originIsSame(request)) return json({ error:"Request origin rejected." }, 403);
    return json({ ok:true }, 200, cookieHeaders(request, "", true));
  }
  if (path === "/api/admin/stats") return request.method === "GET" ? stats(request, env) : json({ error:"Method not allowed." }, 405, { Allow:"GET" });
  return json({ error:"Not found." }, 404);
}
