const http = require("http");
const fs = require("fs");
const path = require("path");
const { normalizeAuthResponse } = require("./auth-response");
const root = __dirname;
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png" };
const tmdbAllowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|top_rated|upcoming|\d+(\/videos)?)|tv\/(popular|on_the_air|top_rated|airing_today|\d+(\/(season\/\d+|videos))?)|person\/\d+|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

function config(name) { try { return JSON.parse(fs.readFileSync(path.join(root, name), "utf8")); } catch { return {}; } }
function sendJSON(response, status, payload) { if (response.headersSent) { response.end(); return; } response.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }); response.end(JSON.stringify(payload)); }
function readBody(request) { return new Promise((resolve, reject) => { let body = ""; request.on("data", chunk => { body += chunk; if (body.length > 50_000) request.destroy(); }); request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON.")); } }); request.on("error", reject); }); }
function supabase() { const local = config("supabase.local.json"), settings = { url:local.url || process.env.SUPABASE_URL, publishableKey:local.publishableKey || process.env.SUPABASE_PUBLISHABLE_KEY, emailRedirectTo:local.emailRedirectTo || process.env.SUPABASE_EMAIL_REDIRECT_TO }; return settings.url && settings.publishableKey ? settings : null; }
function dashboardEnvironment() { const local = config("supabase.local.json"); return { SUPABASE_URL:local.url || process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY:local.publishableKey || process.env.SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY, SEVEN_ADMIN_USERNAME:process.env.SEVEN_ADMIN_USERNAME, SEVEN_ADMIN_PASSWORD:process.env.SEVEN_ADMIN_PASSWORD, SEVEN_DASHBOARD_SECRET:process.env.SEVEN_DASHBOARD_SECRET }; }
async function dashboardAPI(request, response, sourceURL) {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const chunks = [];
    if (!["GET", "HEAD"].includes(request.method)) for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const webRequest = new Request(sourceURL.href, { method:request.method, headers, ...(body ? { body } : {}) });
    const module = await import("../shared/admin-dashboard.mjs");
    const webResponse = await module.handleDashboardRequest(webRequest, dashboardEnvironment());
    for (const [name, value] of webResponse.headers) response.setHeader(name, value);
    response.writeHead(webResponse.status);
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch {
    sendJSON(response, 503, { error:"The local dashboard service is unavailable." });
  }
}
async function downloadRedirect(request, response, sourceURL) {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const webRequest = new Request(sourceURL.href, { method:request.method, headers });
    const module = await import("../shared/admin-dashboard.mjs");
    const webResponse = await module.handleDownloadRedirect(webRequest, dashboardEnvironment(), sourceURL.pathname.slice("/api/install/".length));
    for (const [name, value] of webResponse.headers) response.setHeader(name, value);
    response.writeHead(webResponse.status);
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch {
    const fallback = { mac:"https://github.com/joetheproz5/cineva/releases/latest/download/SEVEN-macOS.dmg", ios:"/", windows:"https://github.com/joetheproz5/cineva/releases/latest/download/SEVEN-Setup-win-x64.exe", android:"/downloads/seven.apk" }[sourceURL.pathname.slice("/go/".length)];
    response.writeHead(fallback ? 302 : 404, { ...(fallback ? { Location:fallback } : {}), "Cache-Control":"no-store" });
    response.end();
  }
}
function authToken(request) { const header = request.headers.authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : null; }
async function upstream(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { error:text }; } return { status:response.status, data }; }
async function proxyTMDB(response, sourceURL) {
  const endpoint = sourceURL.pathname.replace(/^\/api\/tmdb\//, "");
  if (!tmdbAllowed.test(endpoint)) return sendJSON(response, 400, { error:"Unsupported TMDB endpoint." });
  const token = config("tmdb.local.json").bearerToken || process.env.TMDB_BEARER_TOKEN;
  if (!token) return sendJSON(response, 503, { error:"TMDB token missing. Create Web/tmdb.local.json from the example file." });
  try { const result = await upstream(`https://api.themoviedb.org/3/${endpoint}${sourceURL.search}`, { headers:{ Authorization:`Bearer ${token}`, accept:"application/json" } }); sendJSON(response, result.status, result.data); } catch { sendJSON(response, 502, { error:"TMDB is temporarily unavailable." }); }
}
async function auth(request, response, action) {
  const settings = supabase(); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured. Create Web/supabase.local.json." });
  try {
    if (action === "user") { const token = authToken(request); if (!token) return sendJSON(response, 401, { error:"Sign in required." }); const result = await upstream(`${settings.url}/auth/v1/user`, { headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}` } }); return sendJSON(response, result.status, result.data); }
    const body = await readBody(request); let route = ""; let payload = body;
    if (action === "signup") { route = `/auth/v1/signup${settings.emailRedirectTo ? `?redirect_to=${encodeURIComponent(settings.emailRedirectTo)}` : ""}`; payload = { email:body.email, password:body.password, data:{ display_name:body.displayName || "", seven_account:{ onboardingComplete:false, onboardingStep:1 } } }; }
    if (action === "login") route = "/auth/v1/token?grant_type=password";
    if (action === "refresh") route = "/auth/v1/token?grant_type=refresh_token";
    if (!route) return sendJSON(response, 404, { error:"Unknown auth action." });
    const result = await upstream(`${settings.url}${route}`, { method:"POST", headers:{ apikey:settings.publishableKey, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    result.data = normalizeAuthResponse(action, result.data);
    sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Authentication request failed." }); }
}
async function progress(request, response) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") { const result = await upstream(`${settings.url}/rest/v1/playback_progress?select=*&order=last_watched_at.desc`, { headers }); return sendJSON(response, result.status, result.data); }
    if (request.method === "DELETE") { const sourceURL = new URL(request.url, "http://localhost"), profile = sourceURL.searchParams.get("profile"), key = sourceURL.searchParams.get("key"), filter = key ? `content_key=eq.${encodeURIComponent(key)}` : profile ? `content_key=like.${encodeURIComponent(`seven-progress-${profile}-*`)}` : "content_key=not.is.null", result = await upstream(`${settings.url}/rest/v1/playback_progress?${filter}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } }); return sendJSON(response, result.status, result.data); }
    const body = await readBody(request); const result = await upstream(`${settings.url}/rest/v1/playback_progress?on_conflict=user_id,content_key`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body) }); sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Progress sync failed." }); }
}
async function watchTime(request, response) {
  const settings = supabase(), token = authToken(request);
  if (request.method !== "POST") return sendJSON(response, 405, { error:"Method not allowed." });
  if (request.headers.dnt === "1" || request.headers["sec-gpc"] === "1") return sendJSON(response, 204, null);
  if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." });
  if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  try {
    const body = await readBody(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.eventId || "") || !Number.isFinite(Number(body.seconds)) || Number(body.seconds) < 0.5 || Number(body.seconds) > 300) return sendJSON(response, 400, { error:"Invalid watch-time event." });
    const result = await upstream(`${settings.url}/rest/v1/rpc/seven_admin_record_watch_time`, { method:"POST", headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify({ p_event_id:body.eventId, p_seconds:Number(body.seconds) }) });
    return sendJSON(response, result.status, result.data);
  } catch (error) { return sendJSON(response, 400, { error:error.message || "Watch time could not be recorded." }); }
}
async function myList(request, response, sourceURL) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") { const profile = sourceURL.searchParams.get("profile"), filter = profile ? `&profile_id=eq.${encodeURIComponent(profile)}` : "", result = await upstream(`${settings.url}/rest/v1/my_list?select=*&order=added_at.desc${filter}`, { headers }); return sendJSON(response, result.status, result.data); }
    if (request.method === "DELETE") { const profile = sourceURL.searchParams.get("profile") || "main", type = sourceURL.searchParams.get("type"), id = Number(sourceURL.searchParams.get("id")); if (!(["movie", "tv"].includes(type) && Number.isInteger(id))) return sendJSON(response, 400, { error:"A valid list item is required." }); const result = await upstream(`${settings.url}/rest/v1/my_list?profile_id=eq.${encodeURIComponent(profile)}&content_type=eq.${type}&tmdb_id=eq.${id}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } }); return sendJSON(response, result.status, result.data); }
    const body = await readBody(request), payload = { profile_id:String(body.profile_id || "main"), content_type:body.content_type === "tv" ? "tv" : "movie", tmdb_id:Number(body.tmdb_id), title:String(body.title || "Untitled").slice(0, 500), poster_path:body.poster_path || null, backdrop_path:body.backdrop_path || null, release_date:body.release_date || null, vote_average:Number(body.vote_average) || null };
    if (!Number.isInteger(payload.tmdb_id) || payload.tmdb_id < 1) return sendJSON(response, 400, { error:"A valid title is required." });
    const result = await upstream(`${settings.url}/rest/v1/my_list?on_conflict=user_id,profile_id,content_type,tmdb_id`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(payload) }); sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "My List could not be synced." }); }
}
async function accountWatchlist(request, response, sourceURL) {
  const settings = supabase(), token = authToken(request);
  if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." });
  if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  if (!["GET", "POST", "DELETE"].includes(request.method)) return sendJSON(response, 405, { error:"Method not allowed." });
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, table = `${settings.url}/rest/v1/profile_watchlist`;
  try {
    if (request.method === "GET") {
      const profile = sourceURL.searchParams.get("profile");
      if (!profile || !/^[A-Za-z0-9_-]{1,80}$/.test(profile)) return sendJSON(response, 400, { error:"A valid profile is required." });
      const result = await upstream(`${table}?select=*&profile_id=eq.${encodeURIComponent(profile)}&order=added_at.desc`, { headers });
      return sendJSON(response, result.status, result.data);
    }
    if (request.method === "DELETE") {
      const profile = sourceURL.searchParams.get("profile"), type = sourceURL.searchParams.get("type"), id = Number(sourceURL.searchParams.get("id"));
      if (!profile || !/^[A-Za-z0-9_-]{1,80}$/.test(profile)) return sendJSON(response, 400, { error:"A valid profile is required." });
      if (sourceURL.searchParams.get("all") === "true") { const result = await upstream(`${table}?profile_id=eq.${encodeURIComponent(profile)}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } }); return sendJSON(response, result.status, result.data); }
      if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id < 1) return sendJSON(response, 400, { error:"A valid watchlist item is required." });
      const result = await upstream(`${table}?profile_id=eq.${encodeURIComponent(profile)}&content_type=eq.${type}&tmdb_id=eq.${id}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } });
      return sendJSON(response, result.status, result.data);
    }
    const body = await readBody(request), profile = String(body.profile_id || ""), type = body.content_type || body.type, id = Number(body.tmdb_id ?? body.id), title = String(body.title || "Untitled").trim().slice(0, 500) || "Untitled", releaseDate = body.release_date || body.releaseDate || null, rating = body.vote_average == null || body.vote_average === "" ? null : Number(body.vote_average);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(profile)) return sendJSON(response, 400, { error:"A valid profile is required." });
    if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id < 1) return sendJSON(response, 400, { error:"A valid movie or series is required." });
    if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(releaseDate))) return sendJSON(response, 400, { error:"The release date is invalid." });
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) return sendJSON(response, 400, { error:"The rating is invalid." });
    const optionalPath = value => typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null, payload = { profile_id:profile, content_type:type, tmdb_id:id, title, poster_path:optionalPath(body.poster_path || body.posterPath), backdrop_path:optionalPath(body.backdrop_path || body.backdropPath), release_date:releaseDate, vote_average:rating };
    const result = await upstream(`${table}?on_conflict=user_id,profile_id,content_type,tmdb_id`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(payload) });
    return sendJSON(response, result.status, result.data);
  } catch (error) { return sendJSON(response, 400, { error:error.message || "Watchlist could not be synced." }); }
}
async function accountSettings(request, response) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  try {
    const body = await readBody(request), payload = { data:{ seven_account:body.account || {} } };
    if (body.password) {
      if (!body.currentPassword) return sendJSON(response, 400, { error:"Enter your current password." });
      const user = await upstream(`${settings.url}/auth/v1/user`, { headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}` } });
      if (!user.data?.email) return sendJSON(response, 401, { error:"Your session has expired. Please sign in again." });
      const verification = await upstream(`${settings.url}/auth/v1/token?grant_type=password`, { method:"POST", headers:{ apikey:settings.publishableKey, "Content-Type":"application/json" }, body:JSON.stringify({ email:user.data.email, password:body.currentPassword }) });
      if (!verification.data?.access_token) return sendJSON(response, 401, { error:"Your current password is not correct." });
      payload.password = body.password;
    }
    const result = await upstream(`${settings.url}/auth/v1/user`, { method:"PUT", headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Account settings could not be saved." }); }
}
async function parentAccess(request, response) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") { const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_enabled`, { method:"POST", headers, body:"{}" }); return sendJSON(response, result.status, { enabled:result.data === true }); }
    const body = await readBody(request);
    if (request.method === "POST") { const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_verify`, { method:"POST", headers, body:JSON.stringify({ code:String(body.code || "") }) }); return sendJSON(response, result.status, { verified:result.data === true }); }
    if (request.method === "PUT") { const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_set`, { method:"POST", headers, body:JSON.stringify({ current_code:body.currentCode || null, new_code:String(body.newCode || "") }) }); return sendJSON(response, result.status, { enabled:result.data === true }); }
    if (request.method === "DELETE") { const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_clear`, { method:"POST", headers, body:JSON.stringify({ current_code:String(body.currentCode || "") }) }); return sendJSON(response, result.status, { enabled:false }); }
    return sendJSON(response, 405, { error:"Unsupported parent access action." });
  } catch (error) { sendJSON(response, 400, { error:error.message || "Parent access could not be updated." }); }
}
const server = http.createServer((request, response) => {
  const sourceURL = new URL(request.url, "http://localhost");
  if (sourceURL.pathname.startsWith("/api/install/")) return void downloadRedirect(request, response, sourceURL);
  if (sourceURL.pathname === "/api/metrics/event" || sourceURL.pathname.startsWith("/api/admin/")) return void dashboardAPI(request, response, sourceURL);
  if (sourceURL.pathname.startsWith("/api/tmdb/")) return proxyTMDB(response, sourceURL);
  if (sourceURL.pathname === "/api/auth/signup") return auth(request, response, "signup");
  if (sourceURL.pathname === "/api/auth/login") return auth(request, response, "login");
  if (sourceURL.pathname === "/api/auth/refresh") return auth(request, response, "refresh");
  if (sourceURL.pathname === "/api/auth/user") return auth(request, response, "user");
  if (sourceURL.pathname === "/api/account/progress") return progress(request, response);
  if (sourceURL.pathname === "/api/account/watch-time") return watchTime(request, response);
  if (sourceURL.pathname === "/api/account/list") return myList(request, response, sourceURL);
  if (sourceURL.pathname === "/api/account/watchlist") return accountWatchlist(request, response, sourceURL);
  if (sourceURL.pathname === "/api/account/settings" && request.method === "PUT") return accountSettings(request, response);
  if (sourceURL.pathname === "/api/account/parent-access") return parentAccess(request, response);
  let requested = decodeURIComponent(sourceURL.pathname).replace(/^[\\/]+/, ""); if (["dashboard", "dashboard/", "dashboard/accounts", "dashboard/accounts/"].includes(requested)) requested = "dashboard.html"; const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, ""); const file = path.join(root, safePath === "." ? "index.html" : safePath);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, data) => { if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); response.writeHead(200, { "Content-Type":types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" }); response.end(data); });
});
const port = process.env.PORT || 4174; server.listen(port, "0.0.0.0", () => console.log(`SEVEN is available on port ${port}`));
