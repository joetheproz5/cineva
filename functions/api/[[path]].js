const tmdbAllowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|top_rated|upcoming|\d+(\/videos)?)|tv\/(popular|on_the_air|top_rated|airing_today|\d+(\/(season\/\d+|videos))?)|person\/\d+|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "Cache-Control":"no-store" } });
}

async function readJSON(request) {
  try { return await request.json(); }
  catch { throw new Error("Invalid JSON."); }
}

async function upstream(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error:text || "Upstream request failed." }; }
  return { status:response.status, data };
}

function authorization(request) {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function supabase(env) {
  return env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY ? { url:env.SUPABASE_URL, publishableKey:env.SUPABASE_PUBLISHABLE_KEY, emailRedirectTo:env.SUPABASE_EMAIL_REDIRECT_TO || "" } : null;
}

async function tmdb(endpoint, requestURL, env) {
  if (!tmdbAllowed.test(endpoint)) return json({ error:"Unsupported TMDB endpoint." }, 400);
  if (!env.TMDB_BEARER_TOKEN) return json({ error:"TMDB is not configured." }, 503);
  try {
    const result = await upstream(`https://api.themoviedb.org/3/${endpoint}${requestURL.search}`, { headers:{ Authorization:`Bearer ${env.TMDB_BEARER_TOKEN}`, accept:"application/json" } });
    return json(result.data, result.status);
  } catch { return json({ error:"TMDB is temporarily unavailable." }, 502); }
}

async function auth(action, request, env) {
  const settings = supabase(env);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  try {
    if (action === "user") {
      const token = authorization(request);
      if (!token) return json({ error:"Sign in required." }, 401);
      const result = await upstream(`${settings.url}/auth/v1/user`, { headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}` } });
      return json(result.data, result.status);
    }
    const body = await readJSON(request);
    let route = "";
    let payload = body;
    if (action === "signup") {
      route = `/auth/v1/signup${settings.emailRedirectTo ? `?redirect_to=${encodeURIComponent(settings.emailRedirectTo)}` : ""}`;
      payload = { email:body.email, password:body.password, data:{ display_name:body.displayName || "" } };
    }
    if (action === "login") route = "/auth/v1/token?grant_type=password";
    if (action === "refresh") route = "/auth/v1/token?grant_type=refresh_token";
    if (!route) return json({ error:"Unknown auth action." }, 404);
    const result = await upstream(`${settings.url}${route}`, { method:"POST", headers:{ apikey:settings.publishableKey, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    if ((action === "login" || action === "refresh") && result.data?.access_token) result.data = { session:result.data, user:result.data.user };
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "Authentication request failed." }, 400); }
}

async function progress(request, requestURL, env) {
  const settings = supabase(env);
  const token = authorization(request);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  if (!token) return json({ error:"Sign in required." }, 401);
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") {
      const result = await upstream(`${settings.url}/rest/v1/playback_progress?select=*&order=last_watched_at.desc`, { headers });
      return json(result.data, result.status);
    }
    if (request.method === "DELETE") {
      const profile = requestURL.searchParams.get("profile");
      const filter = profile ? `content_key=like.${encodeURIComponent(`seven-progress-${profile}-*`)}` : "content_key=not.is.null";
      const result = await upstream(`${settings.url}/rest/v1/playback_progress?${filter}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } });
      return json(result.data, result.status);
    }
    const body = await readJSON(request);
    const result = await upstream(`${settings.url}/rest/v1/playback_progress?on_conflict=user_id,content_key`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body) });
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "Progress sync failed." }, 400); }
}

async function accountSettings(request, env) {
  const settings = supabase(env);
  const token = authorization(request);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  if (!token) return json({ error:"Sign in required." }, 401);
  try {
    const body = await readJSON(request);
    const payload = { data:{ seven_account:body.account || {} } };
    if (body.password) payload.password = body.password;
    const result = await upstream(`${settings.url}/auth/v1/user`, { method:"PUT", headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "Account settings could not be saved." }, 400); }
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestURL = new URL(request.url);
  const path = Array.isArray(context.params.path) ? context.params.path.join("/") : context.params.path || "";
  if (path.startsWith("tmdb/")) return tmdb(path.slice(5), requestURL, env);
  if (path === "auth/signup" && request.method === "POST") return auth("signup", request, env);
  if (path === "auth/login" && request.method === "POST") return auth("login", request, env);
  if (path === "auth/refresh" && request.method === "POST") return auth("refresh", request, env);
  if (path === "auth/user" && request.method === "GET") return auth("user", request, env);
  if (path === "account/progress") return progress(request, requestURL, env);
  if (path === "account/settings" && request.method === "PUT") return accountSettings(request, env);
  return json({ error:"Not found." }, 404);
}
