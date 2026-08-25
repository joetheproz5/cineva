const tmdbAllowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|top_rated|upcoming|\d+(\/(videos)?)?)|tv\/(popular|on_the_air|top_rated|airing_today|\d+(\/(season\/\d+|videos))?)|person\/\d+|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

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

function config(env) {
  return json({
    configured: Boolean(env.TMDB_BEARER_TOKEN && env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
    supabase: supabase(env),
    realtimeKey: env.SUPABASE_REALTIME_KEY || ""
  });
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
      const key = requestURL.searchParams.get("key");
      const filter = key ? `content_key=eq.${encodeURIComponent(key)}` : profile ? `content_key=like.${encodeURIComponent(`seven-progress-${profile}-*`)}` : "content_key=not.is.null";
      const result = await upstream(`${settings.url}/rest/v1/playback_progress?${filter}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } });
      return json(result.data, result.status);
    }
    const body = await readJSON(request);
    const result = await upstream(`${settings.url}/rest/v1/playback_progress?on_conflict=user_id,content_key`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body) });
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "Progress sync failed." }, 400); }
}

async function myList(request, requestURL, env) {
  const settings = supabase(env);
  const token = authorization(request);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  if (!token) return json({ error:"Sign in required." }, 401);
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") {
      const profile = requestURL.searchParams.get("profile");
      const filter = profile ? `&profile_id=eq.${encodeURIComponent(profile)}` : "";
      const result = await upstream(`${settings.url}/rest/v1/my_list?select=*&order=added_at.desc${filter}`, { headers });
      return json(result.data, result.status);
    }
    if (request.method === "DELETE") {
      const profile = requestURL.searchParams.get("profile") || "main";
      const type = requestURL.searchParams.get("type");
      const id = Number(requestURL.searchParams.get("id"));
      if (!(["movie", "tv"].includes(type) && Number.isInteger(id))) return json({ error:"A valid list item is required." }, 400);
      const result = await upstream(`${settings.url}/rest/v1/my_list?profile_id=eq.${encodeURIComponent(profile)}&content_type=eq.${type}&tmdb_id=eq.${id}`, { method:"DELETE", headers:{ ...headers, Prefer:"return=minimal" } });
      return json(result.data, result.status);
    }
    const body = await readJSON(request);
    const payload = {
      profile_id:String(body.profile_id || "main"),
      content_type:body.content_type === "tv" ? "tv" : "movie",
      tmdb_id:Number(body.tmdb_id),
      title:String(body.title || "Untitled").slice(0, 500),
      poster_path:body.poster_path || null,
      backdrop_path:body.backdrop_path || null,
      release_date:body.release_date || null,
      vote_average:Number(body.vote_average) || null
    };
    if (!Number.isInteger(payload.tmdb_id) || payload.tmdb_id < 1) return json({ error:"A valid title is required." }, 400);
    const result = await upstream(`${settings.url}/rest/v1/my_list?on_conflict=user_id,profile_id,content_type,tmdb_id`, { method:"POST", headers:{ ...headers, Prefer:"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(payload) });
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "My List could not be synced." }, 400); }
}

async function accountSettings(request, env) {
  const settings = supabase(env);
  const token = authorization(request);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  if (!token) return json({ error:"Sign in required." }, 401);
  try {
    const body = await readJSON(request);
    const payload = { data:{ seven_account:body.account || {} } };
    if (body.password) {
      if (!body.currentPassword) return json({ error:"Enter your current password." }, 400);
      const user = await upstream(`${settings.url}/auth/v1/user`, { headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}` } });
      if (!user.data?.email) return json({ error:"Your session has expired. Please sign in again." }, 401);
      const verification = await upstream(`${settings.url}/auth/v1/token?grant_type=password`, { method:"POST", headers:{ apikey:settings.publishableKey, "Content-Type":"application/json" }, body:JSON.stringify({ email:user.data.email, password:body.currentPassword }) });
      if (!verification.data?.access_token) return json({ error:"Your current password is not correct." }, 401);
      payload.password = body.password;
    }
    const result = await upstream(`${settings.url}/auth/v1/user`, { method:"PUT", headers:{ apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    return json(result.data, result.status);
  } catch (error) { return json({ error:error.message || "Account settings could not be saved." }, 400); }
}

async function parentAccess(request, env) {
  const settings = supabase(env);
  const token = authorization(request);
  if (!settings) return json({ error:"Supabase is not configured." }, 503);
  if (!token) return json({ error:"Sign in required." }, 401);
  const headers = { apikey:settings.publishableKey, Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  try {
    if (request.method === "GET") {
      const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_enabled`, { method:"POST", headers, body:"{}" });
      return json({ enabled:result.data === true }, result.status);
    }
    const body = await readJSON(request);
    if (request.method === "POST") {
      const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_verify`, { method:"POST", headers, body:JSON.stringify({ code:String(body.code || "") }) });
      return json({ verified:result.data === true }, result.status);
    }
    if (request.method === "PUT") {
      const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_set`, { method:"POST", headers, body:JSON.stringify({ current_code:body.currentCode || null, new_code:String(body.newCode || "") }) });
      return json({ enabled:result.data === true }, result.status);
    }
    if (request.method === "DELETE") {
      const result = await upstream(`${settings.url}/rest/v1/rpc/seven_parent_access_clear`, { method:"POST", headers, body:JSON.stringify({ current_code:String(body.currentCode || "") }) });
      return json({ enabled:false }, result.status);
    }
    return json({ error:"Unsupported parent access action." }, 405);
  } catch (error) { return json({ error:error.message || "Parent access could not be updated." }, 400); }
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestURL = new URL(request.url);
  const path = Array.isArray(context.params.path) ? context.params.path.join("/") : context.params.path || "";
  if (path === "config" && request.method === "GET") return config(env);
  if (path.startsWith("tmdb/")) return tmdb(path.slice(5), requestURL, env);
  if (path === "auth/signup" && request.method === "POST") return auth("signup", request, env);
  if (path === "auth/login" && request.method === "POST") return auth("login", request, env);
  if (path === "auth/refresh" && request.method === "POST") return auth("refresh", request, env);
  if (path === "auth/user" && request.method === "GET") return auth("user", request, env);
  if (path === "account/progress") return progress(request, requestURL, env);
  if (path === "account/list") return myList(request, requestURL, env);
  if (path === "account/settings" && request.method === "PUT") return accountSettings(request, env);
  if (path === "account/parent-access") return parentAccess(request, env);
  return json({ error:"Not found." }, 404);
}
