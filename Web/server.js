const http = require("http");
const { Readable } = require("stream");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png" };
const tmdbAllowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|top_rated|upcoming|\d+(\/videos)?)|tv\/(popular|on_the_air|top_rated|airing_today|\d+(\/(season\/\d+|videos))?)|person\/\d+|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

function config(name) { try { return JSON.parse(fs.readFileSync(path.join(root, name), "utf8")); } catch { return {}; } }
function sendJSON(response, status, payload) { if (response.headersSent) { response.end(); return; } response.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }); response.end(JSON.stringify(payload)); }
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
    if (request.method === "DELETE") { const sourceURL = new URL(request.url, "http://localhost"), profile = sourceURL.searchParams.get("profile"), key = sourceURL.searchParams.get("key"), filter = key ? `content_key=eq.${encodeURIComponent(key)}` : profile ? `content_key=like.${encodeURIComponent(`seven-progress-${profile}-*`)}` : "content_key=not.is.null", result = await upstream(`${settings.url}/rest/v1/playback_progress?${filter}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } }); return sendJSON(response, result.status, result.data); }
    const body = await readBody(request); const result = await upstream(`${settings.url}/rest/v1/playback_progress?on_conflict=user_id,content_key`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body) }); sendJSON(response, result.status, result.data);
  } catch (error) { sendJSON(response, 400, { error:error.message || "Progress sync failed." }); }
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
// Local dev parity for the Cloudflare adblocking player proxy (functions/api/player).
const PLAYER_HOSTS = { vidlink:"https://vidlink.pro", vidsrc:"https://vidsrc.sbs", vidking:"https://www.vidking.net", "2embed":"https://www.2embed.online" };
const PLAYER_BLOCK = ["borrowhourglass.com", "mc.yandex.ru", "yandex.ru", "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com", "popads.net", "popcash.net", "popunder", "propellerads", "propu.sh", "monetag", "adsterra", "hilltopads", "exoclick", "clickadu", "ad-maven", "bidvertiser", "adcash", "galaksion", "tsyndicate.com", "histats.com", "/ads.js", "/pop.js", "adblock-detect"];
function playerBad(url) { try { const u = new URL(url, "http://x.invalid"); const h = u.hostname.toLowerCase(), s = u.href.toLowerCase(); return PLAYER_BLOCK.some(part => h.includes(part) || s.includes(part)); } catch { return false; } }
async function playerProxy(request, response, sourceURL) {
  const pathname = decodeURIComponent(sourceURL.pathname);
  const streamUp = async (target, referer) => {
    try {
      const up = await fetch(target, { headers: { "User-Agent": request.headers["user-agent"] || "Mozilla/5.0", "Referer": referer + "/" }, redirect: "follow" });
      const headers = {};
      ["content-type", "content-length", "cache-control"].forEach(name => { const value = up.headers.get(name); if (value) headers[name] = value; });
      response.writeHead(up.status, headers);
      if (up.body) { Readable.fromWeb(up.body).on("error", () => response.end()).pipe(response); } else { response.end(); }
    } catch { response.writeHead(502, { "Content-Type": "text/plain" }); response.end("upstream failed"); }
  };
  const fetchText = async (target, referer) => {
    try {
      const up = await fetch(target, { headers: { "User-Agent": request.headers["user-agent"] || "Mozilla/5.0", "Referer": referer + "/" }, redirect: "follow" });
      return { status: up.status, text: await up.text(), final: up.url || target, type: up.headers.get("content-type") || "" };
    } catch { return { status: 502, text: "<!doctype html><title>Player unavailable</title>", final: target }; }
  };
  const rewrite = (html, base) => {
    html = html.replace(/<script\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')[^>]*>\s*<\/script>/gi, (tag, _q, dq, sq) => playerBad(dq ?? sq) ? "<!--seven-ad-stripped-->" : tag);
    html = html.replace(/\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi, (attr, name, _q, dq, sq) => {
      const value = dq ?? sq;
      if (!value || /^(#|data:|blob:|about:|\/\/)/.test(value)) return attr;
      let resolved; try { resolved = new URL(value, base).href; } catch { return attr; }
      if (playerBad(resolved)) return `${name}="about:blank"`;
      if (/\.(m3u8|ts|m4s|mp4|webm|vtt)($|\?)/i.test(resolved)) return attr;
      const entry = Object.entries(PLAYER_HOSTS).find(([, host]) => resolved.startsWith(host));
      if (!entry && !value.startsWith("/")) return attr;
      return `${name}="/api/player/${entry ? entry[0] : "vidlink"}/${(entry ? resolved.slice(entry[1].length) : resolved).replace(/^\//, "")}"`;
    });
    html = html.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}><script src="/api/player/shield.js"></script>`) || `<script src="/api/player/shield.js"></script>${html}`;
    return html;
  };
  const subPath = pathname.replace(/^\/api\/player\//, "");
  if (subPath === "shield.js") { response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); return response.end("(function(){var mem=Object.create(null);var stub={getItem:function(k){return k in mem?mem[k]:null},setItem:function(k,v){mem[k]=String(v)},removeItem:function(k){delete mem[k]},clear:function(){mem=Object.create(null)},key:function(i){return Object.keys(mem)[i]||null}};Object.defineProperty(stub,'length',{get:function(){return Object.keys(mem).length}});['localStorage','sessionStorage'].forEach(function(n){try{Object.defineProperty(window,n,{get:function(){return stub},configurable:false})}catch(e){}});try{Object.defineProperty(document,'cookie',{get:function(){return ''},set:function(){},configurable:false})}catch(e){};var B=" + JSON.stringify(PLAYER_BLOCK) + ";function bad(u){try{var x=new URL(u,location.href),h=x.hostname.toLowerCase(),s=x.href.toLowerCase();return B.some(function(p){return h.indexOf(p)!==-1||s.indexOf(p)!==-1})}catch(e){return false}}window.open=function(){return null};var of=window.fetch;if(of)window.fetch=function(i){var u=typeof i==='string'?i:(i&&i.url)||'';if(bad(u))return Promise.resolve(new Response('',{status:204}));return of.apply(this,arguments)};var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(bad(u))arguments[1]='data:text/plain,';return oo.apply(this,arguments)};document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a&&(a.target==='_blank'||bad(a.href))){e.preventDefault();e.stopPropagation()}},true);})();"); }
  const forwardRoute = (prefix, provider, origin) => {
    if (!pathname.startsWith(prefix)) return false;
    const target = `${origin}${pathname.slice(prefix.length)}${sourceURL.search || ""}`;
    if (/\.(m3u8|ts|m4s|mp4|webm|vtt)($|\?)/i.test(target)) { void streamUp(target, origin); return true; }
    void fetchText(target, origin).then(result => {
      if (/text\/html/i.test(result.type || "")) { response.writeHead(result.status, { "Content-Type": "text/html; charset=utf-8" }); response.end(rewrite(result.text, result.final)); return; }
      void streamUp(target, origin);
    });
    return true;
  };
  if (forwardRoute("/_next/", "vidlink", PLAYER_HOSTS.vidlink)) return;
  if (forwardRoute("/assets/", "vidking", PLAYER_HOSTS.vidking)) return;
  if (forwardRoute("/static/", "vidsrc", PLAYER_HOSTS.vidsrc)) return;
  const slash = subPath.indexOf("/");
  const provider = slash === -1 ? subPath : subPath.slice(0, slash);
  const rest = slash === -1 ? "" : subPath.slice(slash + 1);
  const origin = PLAYER_HOSTS[provider];
  if (!origin) { response.writeHead(404, { "Content-Type": "text/plain" }); return response.end("Unknown player"); }
  const target = `${origin}/${rest}${sourceURL.search || ""}`;
  if (/\.(m3u8|ts|m4s|mp4|webm|vtt)($|\?)/i.test(target)) return streamUp(target, origin);
  const result = await fetchText(target, origin);
  if (/text\/html/i.test(result.type || "")) { response.writeHead(result.status, { "Content-Type": "text/html; charset=utf-8" }); return response.end(rewrite(result.text, result.final)); }
  return streamUp(target, origin);
}
const server = http.createServer((request, response) => {
  const sourceURL = new URL(request.url, "http://localhost");
  if (sourceURL.pathname.startsWith("/api/tmdb/")) return proxyTMDB(response, sourceURL);
  if (sourceURL.pathname === "/api/player" || sourceURL.pathname.startsWith("/api/player/")) return playerProxy(request, response, sourceURL);
  if (sourceURL.pathname === "/api/auth/signup") return auth(request, response, "signup");
  if (sourceURL.pathname === "/api/auth/login") return auth(request, response, "login");
  if (sourceURL.pathname === "/api/auth/refresh") return auth(request, response, "refresh");
  if (sourceURL.pathname === "/api/auth/user") return auth(request, response, "user");
  if (sourceURL.pathname === "/api/account/progress") return progress(request, response);
  if (sourceURL.pathname === "/api/account/list") return myList(request, response, sourceURL);
  if (sourceURL.pathname === "/api/account/settings" && request.method === "PUT") return accountSettings(request, response);
  if (sourceURL.pathname === "/api/account/parent-access") return parentAccess(request, response);
  const requested = decodeURIComponent(sourceURL.pathname).replace(/^[\\/]+/, ""); const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, ""); const file = path.join(root, safePath === "." ? "index.html" : safePath);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, data) => { if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); response.writeHead(200, { "Content-Type":types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" }); response.end(data); });
});
const port = process.env.PORT || 4174; server.listen(port, "0.0.0.0", () => console.log(`SEVEN is available on port ${port}`));
