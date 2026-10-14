import { buildPushPayload } from "@block65/webcrypto-web-push";
import { validateFollows, releaseDecision } from "./episodes.js";

const ALLOWED_ORIGINS = new Set([
  "https://seven-9fm.pages.dev",
  "https://joetheproz5.github.io"
]);
const MAX_BODY_BYTES = 32768;
const MAX_REMINDERS_PER_DEVICE = 80;
const MAX_REMINDER_YEARS_AHEAD = 10;
const MAX_DELIVERIES_PER_RUN = 10;
const CHECK_RETRY_MINUTES = 45;
const encoder = new TextEncoder();

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, cors) {
  return Response.json(data, { status, headers: { ...cors, "Cache-Control": "no-store" } });
}

function errorResponse(message, status, cors) {
  return json({ error: message }, status, cors);
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw new RangeError("Request body is too large.");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) throw new RangeError("Request body is too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new TypeError("Request body must be valid JSON.");
  }
}

function bearerToken(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(request.headers.get("authorization") || "");
  return match?.[1] || null;
}

async function deviceIdForToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticatedDevice(request, env, { create = false } = {}) {
  const token = bearerToken(request);
  if (!token) return null;
  const id = await deviceIdForToken(token);
  if (create) {
    await env.DB.prepare(`INSERT INTO devices (id) VALUES (?)
      ON CONFLICT(id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`).bind(id).run();
  }
  const device = await env.DB.prepare("SELECT id FROM devices WHERE id = ?").bind(id).first();
  if (!device) return null;
  await env.DB.prepare("UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return id;
}

function validatePushEndpoint(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const approved = host === "fcm.googleapis.com"
      || host.endsWith(".push.services.mozilla.com")
      || host === "push.services.mozilla.com"
      || host === "web.push.apple.com"
      || host.endsWith(".push.apple.com")
      || host.endsWith(".notify.windows.com");
    return url.protocol === "https:" && !url.username && !url.password && approved;
  } catch {
    return false;
  }
}

function validDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function withinReminderWindow(date) {
  if (!validDate(date)) return false;
  const today = new Date().toISOString().slice(0, 10);
  const latest = new Date();
  latest.setUTCFullYear(latest.getUTCFullYear() + MAX_REMINDER_YEARS_AHEAD);
  return date >= today && date <= latest.toISOString().slice(0, 10);
}

async function handleSubscribe(request, env, cors) {
  if (!bearerToken(request)) return errorResponse("A valid device token is required.", 401, cors);
  const body = await readJson(request);
  const subscription = body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!validatePushEndpoint(endpoint) || typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{20,256}$/.test(p256dh)
      || typeof auth !== "string" || !/^[A-Za-z0-9_-]{20,256}$/.test(auth)) {
    return errorResponse("This browser returned an invalid push subscription.", 400, cors);
  }
  const deviceId = await authenticatedDevice(request, env, { create: true });
  if (!deviceId) return errorResponse("A valid device token is required.", 401, cors);
  await env.DB.prepare(`INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh,
      auth = excluded.auth, created_at = CURRENT_TIMESTAMP
    ON CONFLICT(endpoint) DO UPDATE SET device_id = excluded.device_id, p256dh = excluded.p256dh,
      auth = excluded.auth, created_at = CURRENT_TIMESTAMP`).bind(deviceId, endpoint, p256dh, auth).run();
  return json({ ok: true }, 200, cors);
}

async function handleUnsubscribe(request, env, cors) {
  const deviceId = await authenticatedDevice(request, env);
  if (!deviceId) return json({ ok: true }, 200, cors);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM episode_follows WHERE device_id = ?").bind(deviceId),
    env.DB.prepare("DELETE FROM episode_follow_sets WHERE device_id = ?").bind(deviceId),
    env.DB.prepare("DELETE FROM release_reminders WHERE device_id = ?").bind(deviceId),
    env.DB.prepare("DELETE FROM push_subscriptions WHERE device_id = ?").bind(deviceId),
    env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(deviceId)
  ]);
  return json({ ok: true }, 200, cors);
}

async function handleReminders(request, env, url, cors) {
  const deviceId = await authenticatedDevice(request, env);
  if (!deviceId && request.method === "DELETE") return json({ ok: true }, 200, cors);
  if (!deviceId) return errorResponse("A valid device token is required.", 401, cors);

  if (request.method === "GET") {
    const result = await env.DB.prepare(`SELECT media_type AS type, tmdb_id AS id, title,
      poster_path AS posterPath, release_date AS releaseDate, notified_at AS notifiedAt
      FROM release_reminders WHERE device_id = ? ORDER BY release_date, title`).bind(deviceId).all();
    return json({ reminders: result.results || [] }, 200, cors);
  }

  if (request.method === "DELETE") {
    const type = url.searchParams.get("type");
    const id = Number(url.searchParams.get("id"));
    if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id < 1) {
      return errorResponse("A valid title is required.", 400, cors);
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM release_reminders WHERE device_id = ? AND media_type = ? AND tmdb_id = ?")
        .bind(deviceId, type, id),
      env.DB.prepare(`DELETE FROM push_subscriptions WHERE device_id = ?
        AND NOT EXISTS (SELECT 1 FROM release_reminders WHERE device_id = ?)
        AND NOT EXISTS (SELECT 1 FROM episode_follows WHERE device_id = ?)`)
        .bind(deviceId, deviceId, deviceId),
      env.DB.prepare(`DELETE FROM devices WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE device_id = ?)
        AND NOT EXISTS (SELECT 1 FROM release_reminders WHERE device_id = ?)
        AND NOT EXISTS (SELECT 1 FROM episode_follow_sets WHERE device_id = ?)`)
        .bind(deviceId, deviceId, deviceId, deviceId)
    ]);
    return json({ ok: true }, 200, cors);
  }

  const body = await readJson(request);
  const type = body?.type;
  const id = Number(body?.id);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  const date = body?.releaseDate;
  const posterPath = typeof body?.posterPath === "string" && /^\/[A-Za-z0-9_./-]{1,190}$/.test(body.posterPath)
    ? body.posterPath : null;
  if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id < 1 || !title || !withinReminderWindow(date)) {
    return errorResponse("This title does not have a valid upcoming release date.", 400, cors);
  }
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM release_reminders WHERE device_id = ?")
    .bind(deviceId).first("total");
  if (Number(count) >= MAX_REMINDERS_PER_DEVICE) {
    return errorResponse(`A device can have up to ${MAX_REMINDERS_PER_DEVICE} release reminders.`, 409, cors);
  }
  await env.DB.prepare(`INSERT INTO release_reminders (device_id, media_type, tmdb_id, title, poster_path, release_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id, media_type, tmdb_id) DO UPDATE SET title = excluded.title,
      poster_path = excluded.poster_path,
      notified_at = CASE WHEN release_reminders.release_date <> excluded.release_date THEN NULL ELSE release_reminders.notified_at END,
      checked_at = CASE WHEN release_reminders.release_date <> excluded.release_date THEN NULL ELSE release_reminders.checked_at END,
      release_date = excluded.release_date`).bind(deviceId, type, id, title, posterPath, date).run();
  return json({ ok: true }, 201, cors);
}

async function handleEpisodeFollows(request,env,cors) {
  const deviceId=await authenticatedDevice(request,env);
  if(!deviceId)return errorResponse("Register notifications on this device first.",401,cors);
  const body=validateFollows(await readJson(request)),ids=body.series.map(item=>item.id);
  const statements=[env.DB.prepare(`INSERT INTO episode_follow_sets(device_id,revision) VALUES(?,?)
    ON CONFLICT(device_id) DO UPDATE SET revision=excluded.revision WHERE excluded.revision>=episode_follow_sets.revision`).bind(deviceId,body.revision)];
  statements.push(env.DB.prepare(`DELETE FROM episode_follows WHERE device_id=?
    AND EXISTS(SELECT 1 FROM episode_follow_sets WHERE device_id=? AND revision=?)
    ${ids.length?`AND tmdb_id NOT IN (${ids.map(()=>"?").join(",")})`:""}`).bind(deviceId,deviceId,body.revision,...ids));
  for(const item of body.series)statements.push(env.DB.prepare(`INSERT INTO episode_follows(device_id,tmdb_id,profile_scope,title,last_season,last_episode)
    SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM episode_follow_sets WHERE device_id=? AND revision=?)
    ON CONFLICT(device_id,tmdb_id) DO UPDATE SET title=excluded.title,
      last_season=CASE WHEN episode_follows.profile_scope<>excluded.profile_scope THEN excluded.last_season ELSE episode_follows.last_season END,
      last_episode=CASE WHEN episode_follows.profile_scope<>excluded.profile_scope THEN excluded.last_episode ELSE episode_follows.last_episode END,
      next_check_at=CASE WHEN episode_follows.profile_scope<>excluded.profile_scope THEN NULL ELSE episode_follows.next_check_at END,
      profile_scope=excluded.profile_scope`).bind(deviceId,item.id,body.scope,item.title,item.season,item.episode,deviceId,body.revision));
  await env.DB.batch(statements);return json({ok:true},200,cors);
}
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") || "";
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (url.pathname === "/health" && request.method === "GET") return json({ ok: true }, 200, cors);
  if (url.pathname === "/api/vapid-public-key" && request.method === "GET") {
    if (!env.VAPID_PUBLIC_KEY) return errorResponse("Push alerts are not configured yet.", 503, cors);
    return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, cors);
  }
  if (url.pathname === "/api/subscriptions" && request.method === "POST") return handleSubscribe(request, env, cors);
  if (url.pathname === "/api/subscriptions" && request.method === "DELETE") return handleUnsubscribe(request, env, cors);
  if (url.pathname === "/api/episode-follows" && request.method === "POST") return handleEpisodeFollows(request,env,cors);
  if (url.pathname === "/api/reminders" && ["GET", "POST", "DELETE"].includes(request.method)) {
    return handleReminders(request, env, url, cors);
  }
  return errorResponse("Not found.", 404, cors);
}

async function refreshTmdbRelease(reminder, env) {
  const type = reminder.media_type;
  const url = `${env.TMDB_PROXY_BASE}${type}/${reminder.tmdb_id}?language=en-US`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`TMDB metadata request failed (${response.status}).`);
  const data = await response.json();
  return {
    date: type === "movie" ? data.release_date : data.first_air_date,
    title: (type === "movie" ? data.title : data.name) || reminder.title
  };
}

async function deliverDueReminders(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    console.error("Release reminders are not configured: VAPID keys are missing.");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const due = await env.DB.prepare(`SELECT r.id, r.device_id, r.media_type, r.tmdb_id, r.title,
      r.release_date, s.endpoint, s.p256dh, s.auth
    FROM release_reminders r JOIN push_subscriptions s ON s.device_id = r.device_id
    WHERE r.notified_at IS NULL AND r.release_date <= ?
      AND (r.checked_at IS NULL OR r.checked_at <= datetime('now', '-${CHECK_RETRY_MINUTES} minutes'))
    ORDER BY r.release_date, r.id LIMIT ${MAX_DELIVERIES_PER_RUN}`).bind(today).all();
  for (const reminder of due.results || []) {
    const claim = await env.DB.prepare(`UPDATE release_reminders SET checked_at = CURRENT_TIMESTAMP
      WHERE id = ? AND notified_at IS NULL
        AND (checked_at IS NULL OR checked_at <= datetime('now', '-${CHECK_RETRY_MINUTES} minutes'))`).bind(reminder.id).run();
    if (!claim.meta?.changes) continue;

    try {
      const metadata = await refreshTmdbRelease(reminder, env);
      if (!validDate(metadata.date)) continue;
      if (metadata.date > today) {
        await env.DB.prepare("UPDATE release_reminders SET release_date = ?, title = ? WHERE id = ?")
          .bind(metadata.date, metadata.title, reminder.id).run();
        continue;
      }
      const vapid = {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY
      };
      const subscription = { endpoint: reminder.endpoint, keys: { p256dh: reminder.p256dh, auth: reminder.auth } };
      const title = metadata.title || reminder.title;
      const target = new URL(`/?title=${encodeURIComponent(`${reminder.media_type}:${reminder.tmdb_id}`)}`, env.APP_BASE_URL);
      const payload = await buildPushPayload({
        data: JSON.stringify({
          title: "Release day",
          body: `${title} has reached its listed release date.`,
          url: target.href
        }),
        options: { ttl: 86400, urgency: "normal" }
      }, subscription, vapid);
      const pushResponse = await fetch(reminder.endpoint, { ...payload, signal: AbortSignal.timeout(10000) });
      if (pushResponse.status === 404 || pushResponse.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE device_id = ?").bind(reminder.device_id).run();
        continue;
      }
      if (!pushResponse.ok) throw new Error(`Push service returned ${pushResponse.status}.`);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM release_reminders WHERE id = ? AND notified_at IS NULL").bind(reminder.id),
        env.DB.prepare(`DELETE FROM push_subscriptions WHERE device_id = ?
          AND NOT EXISTS (SELECT 1 FROM release_reminders WHERE device_id = ?)
          AND NOT EXISTS (SELECT 1 FROM episode_follows WHERE device_id = ?)`)
          .bind(reminder.device_id, reminder.device_id, reminder.device_id),
        env.DB.prepare(`DELETE FROM devices WHERE id = ?
          AND NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE device_id = ?)
          AND NOT EXISTS (SELECT 1 FROM release_reminders WHERE device_id = ?)
          AND NOT EXISTS (SELECT 1 FROM episode_follow_sets WHERE device_id = ?)`)
          .bind(reminder.device_id, reminder.device_id, reminder.device_id, reminder.device_id)
      ]);
    } catch (error) {
      console.error("Release reminder delivery failed.", { reminderId: reminder.id, message: error?.message || "Unknown error" });
    }
  }
}

async function deliverEpisodeFollows(env) {
  if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)return;
  // Together with the ten legacy reminder deliveries, stay below 50 external requests/run.
  const due=await env.DB.prepare(`SELECT f.tmdb_id FROM episode_follows f JOIN push_subscriptions s ON s.device_id=f.device_id
    WHERE (f.next_check_at IS NULL OR f.next_check_at<=CURRENT_TIMESTAMP)
      AND (f.checked_at IS NULL OR f.checked_at<=datetime('now','-45 minutes'))
    GROUP BY f.tmdb_id ORDER BY COALESCE(MIN(f.checked_at),'1970-01-01') LIMIT 8`).all();
  let remaining=20;
  for(const entry of due.results||[]) {
    let show;
    try{const response=await fetch(`${env.TMDB_PROXY_BASE}tv/${entry.tmdb_id}?language=en-US`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error("Episode metadata unavailable.");show=await response.json();}
    catch(error){console.error("Episode metadata check failed.",{id:entry.tmdb_id,message:error.message});await env.DB.prepare("UPDATE episode_follows SET checked_at=CURRENT_TIMESTAMP,next_check_at=datetime('now','+45 minutes') WHERE tmdb_id=?").bind(entry.tmdb_id).run();continue;}
    const follows=await env.DB.prepare(`SELECT f.*,s.endpoint,s.p256dh,s.auth FROM episode_follows f JOIN push_subscriptions s ON s.device_id=f.device_id WHERE f.tmdb_id=?
      AND (f.next_check_at IS NULL OR f.next_check_at<=CURRENT_TIMESTAMP)
      AND (f.checked_at IS NULL OR f.checked_at<=datetime('now','-45 minutes'))
      ORDER BY COALESCE(f.checked_at,'1970-01-01') LIMIT 30`).bind(entry.tmdb_id).all();
    for(const follow of follows.results||[]) {
      const decision=releaseDecision(follow,show);
      if(decision.notify&&remaining<=0)continue;
      const claim=await env.DB.prepare(`UPDATE episode_follows SET checked_at=CURRENT_TIMESTAMP WHERE device_id=? AND tmdb_id=? AND profile_scope=? AND last_season=? AND last_episode=?
        AND (checked_at IS NULL OR checked_at<=datetime('now','-45 minutes'))`).bind(follow.device_id,follow.tmdb_id,follow.profile_scope,follow.last_season,follow.last_episode).run();
      if(!claim.meta?.changes)continue;
      try {
        if(decision.notify) {
          const target=new URL(`/?title=tv:${follow.tmdb_id}`,env.APP_BASE_URL);
          const payload=await buildPushPayload({data:JSON.stringify({title:decision.newSeason?"New season":"New episode",body:`${show.name||follow.title} · S${decision.season} E${decision.episode} has reached its listed release date.`,url:target.href,tag:`seven-episode-${follow.tmdb_id}-${decision.season}-${decision.episode}`}),options:{ttl:86400,urgency:"normal"}},{endpoint:follow.endpoint,keys:{p256dh:follow.p256dh,auth:follow.auth}},{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
          remaining--;const response=await fetch(follow.endpoint,{...payload,signal:AbortSignal.timeout(10000)});
          if([404,410].includes(response.status)){await env.DB.prepare("DELETE FROM push_subscriptions WHERE device_id=?").bind(follow.device_id).run();continue;}
          if(!response.ok)throw Error(`Push returned ${response.status}.`);
        }
        // Recheck unannounced/changed dates within six hours; announced dates at least daily.
        await env.DB.prepare(`UPDATE episode_follows SET title=?,last_season=?,last_episode=?,next_check_at=CASE WHEN ? IS NULL THEN datetime('now','+6 hours') WHEN datetime(?)<datetime('now','+1 day') THEN datetime(?) ELSE datetime('now','+1 day') END
          WHERE device_id=? AND tmdb_id=? AND profile_scope=? AND last_season=? AND last_episode=?`).bind(show.name||follow.title,decision.notify?decision.season:follow.last_season,decision.notify?decision.episode:follow.last_episode,decision.nextDate,decision.nextDate,decision.nextDate,follow.device_id,follow.tmdb_id,follow.profile_scope,follow.last_season,follow.last_episode).run();
      }catch(error){console.error("Episode alert delivery failed.",{id:follow.tmdb_id,message:error.message});}
    }
  }
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/__scheduled") return new Response("Not found.", { status: 404 });
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const origin = request.headers.get("origin") || "";
      const cors = isAllowedOrigin(origin) ? corsHeaders(origin) : {};
      if (error instanceof RangeError) return errorResponse(error.message, 413, cors);
      if (error instanceof TypeError) return errorResponse(error.message, 400, cors);
      console.error("Release reminder request failed.", error?.message || "Unknown error");
      return errorResponse("The release reminder could not be saved. Please try again.", 500, cors);
    }
  },
  async scheduled(_controller, env) {
    await deliverDueReminders(env);
    await deliverEpisodeFollows(env);
  }
};
