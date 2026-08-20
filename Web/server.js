const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png" };
const tmdbAllowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|top_rated|upcoming|\d+(\/videos)?)|tv\/(popular|on_the_air|top_rated|airing_today|\d+(\/(season\/\d+|videos))?)|person\/\d+|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

function config(name) { try { return JSON.parse(fs.readFileSync(path.join(root, name), "utf8")); } catch { return {}; } }
function sendJSON(response, status, payload) { response.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }); response.end(JSON.stringify(payload)); }
function readBody(request) { return new Promise((resolve, reject) => { let body = ""; request.on("data", chunk => { body += chunk; if (body.length > 50_000) request.destroy(); }); request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON.")); } }); request.on("error", reject); }); }
function supabase() { const local = config("supabase.local.json"), settings = { url:local.url || process.env.SUPABASE_URL, publishableKey:local.publishableKey || process.env.SUPABASE_PUBLISHABLE_KEY, emailRedirectTo:local.emailRedirectTo || process.env.SUPABASE_EMAIL_REDIRECT_TO }; return settings.url && settings.publishableKey ? settings : null; }
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
    if (action === "signup") { route = `/auth/v1/signup${settings.emailRedirectTo ? `?redirect_to=${encodeURIComponent(settings.emailRedirectTo)}` : ""}`; payload = { email:body.email, password:body.password, data:{ display_name:body.displayName || "" } }; }
    if (action === "login") route = "/auth/v1/token?grant_type=password";
    if (action === "refresh") route = "/auth/v1/token?grant_type=refresh_token";
    if (!route) return sendJSON(response, 404, { error:"Unknown auth action." });
    const result = await upstream(`${settings.url}${route}`, { method:"POST", headers:{ apikey:settings.publishableKey, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    if ((action === "login" || action === "refresh") && result.data?.access_token) result.data = { session:result.data, user:result.data.user };
    sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Authentication request failed." }); }
}
async function progress(request, response) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") { const result = await upstream(`${settings.url}/rest/v1/playback_progress?select=*&order=last_watched_at.desc`, { headers }); return sendJSON(response, result.status, result.data); }
    if (request.method === "DELETE") { const profile = new URL(request.url, "http://localhost").searchParams.get("profile"), filter = profile ? `content_key=like.${encodeURIComponent(`seven-progress-${profile}-*`)}` : "content_key=not.is.null", result = await upstream(`${settings.url}/rest/v1/playback_progress?${filter}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } }); return sendJSON(response, result.status, result.data); }
    const body = await readBody(request); const result = await upstream(`${settings.url}/rest/v1/playback_progress?on_conflict=user_id,content_key`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body) }); sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Progress sync failed." }); }
}
async function accountSettings(request, response) {
  const settings = supabase(), token = authToken(request); if (!settings) return sendJSON(response, 503, { error:"Supabase is not configured." }); if (!token) return sendJSON(response, 401, { error:"Sign in required." });
  try { const body = await readBody(request), payload = { data:{ seven_account:body.account || {} } }; if (body.password) payload.password = body.password; const result = await upstream(`${settings.url}/auth/v1/user`, { method:"PUT", headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(payload) }); sendJSON(response, result.status, result.data); } catch (error) { sendJSON(response, 400, { error:error.message || "Account settings could not be saved." }); }
}
const server = http.createServer((request, response) => {
  const sourceURL = new URL(request.url, "http://localhost");
  if (sourceURL.pathname.startsWith("/api/tmdb/")) return proxyTMDB(response, sourceURL);
  if (sourceURL.pathname === "/api/auth/signup") return auth(request, response, "signup");
  if (sourceURL.pathname === "/api/auth/login") return auth(request, response, "login");
  if (sourceURL.pathname === "/api/auth/refresh") return auth(request, response, "refresh");
  if (sourceURL.pathname === "/api/auth/user") return auth(request, response, "user");
  if (sourceURL.pathname === "/api/account/progress") return progress(request, response);
  if (sourceURL.pathname === "/api/account/settings" && request.method === "PUT") return accountSettings(request, response);
  const requested = decodeURIComponent(sourceURL.pathname).replace(/^[\\/]+/, ""); const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, ""); const file = path.join(root, safePath === "." ? "index.html" : safePath);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, data) => { if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); response.writeHead(200, { "Content-Type":types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" }); response.end(data); });
});
const port = process.env.PORT || 4174; server.listen(port, "0.0.0.0", () => console.log(`SEVEN is available on port ${port}`));
