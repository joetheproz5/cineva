// SEVEN adblocking player proxy.
// Routes provider embeds through this same-origin Function so the edge can:
//   1. strip known ad/analytics scripts and frames from the HTML,
//   2. serve their app assets via /raw (ad URLs get emptied before the browser ever runs them),
//   3. inject frame-shield.js first in <head> (runtime fetch/XHR/DOM blocking),
//   4. cage the document with a restrictive CSP (no popups, no top navigation, frames only from https).
// Video data is never proxied — streams keep loading directly from their CDNs.

const PROVIDERS = {
  vidlink: "https://vidlink.pro",
  vidsrc: "https://vidsrc.sbs",
  vidking: "https://www.vidking.net",
  "2embed": "https://www.2embed.online"
};

// Hosts whose own app assets (HTML/JS/CSS) are routed through this proxy.
const ROUTE_HOSTS = ["vidlink.pro", "vidsrc.sbs", "vidking.net", "2embed.online"];

// Hosts and URL fragments that are ads, popups, or tracking. Emptied at the edge and blocked in-frame.
const BLOCK_FRAGMENTS = [
  "borrowhourglass.com", "mc.yandex.ru", "yandex.ru/metrika", "an.yandex.ru", "adfox.ru",
  "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com", "adservice.google",
  "popads.net", "popcash.net", "popunder", "popu.", "propellerads", "propu.sh", "monetag", "zeropark",
  "adsterra", "hilltopads", "exoclick", "exosrv", "exdynsrv", "clickaine", "ad-maven", "admaven",
  "onclickalgo", "onclickmega", "onclickperformance", "onclickpredictiv", "onclickserv", "adca.st",
  "bidvertiser", "adcash", "galaksion", "richpops", "juicyads", "trafficjunky", "trafficstars",
  "tsyndicate.com", "clickadu", "adavigator", "adtival", "clickadilla", "adgain", "adpus", "adsfacilitate",
  "histats.com", "statcounter.com", "quantserve.com", "scorecardresearch.com", "adriver.ru", "top-fwz1.mail.ru",
  "/ads.js", "/ad.js", "/pop.js", "adblock-detect", "adblockdetect", "/prebid", "/gamads", "ktxvaeh", "svonm"
];

// Legitimate hosts the shield must never touch.
const ALLOW_HOSTS = [
  "image.tmdb.org", "wsrv.nl", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
  "fonts.googleapis.com", "fonts.gstatic.com", "www.youtube.com", "youtube-nocookie.com", "img.youtube.com", "i.ytimg.com",
  "vidlink.pro", "vidsrc.sbs", "vidking.net", "2embed.online", "vidsrc.to", "vidsrc.xyz", "vjs.zencdn.net"
];

// Media that must stream directly from its CDN — never rewritten, never proxied.
const MEDIA_FILE = /\.(m3u8|ts|m4s|mp4|mkv|webm|mpd|aac|vtt|srt)($|\?)/i;

function isBlocked(url) {
  try {
    const u = new URL(url, "https://x.invalid");
    const host = u.hostname.toLowerCase(), href = u.href.toLowerCase();
    if (ALLOW_HOSTS.some(allow => host === allow || host.endsWith("." + allow))) return false;
    return BLOCK_FRAGMENTS.some(part => host.includes(part) || href.includes(part));
  } catch { return false; }
}

function isRoutedHost(url) {
  try { const host = new URL(url).hostname.toLowerCase(); return ROUTE_HOSTS.some(h => host === h || host.endsWith("." + h)); }
  catch { return false; }
}

function rawURL(url, depth) { return `/api/player/raw?u=${encodeURIComponent(url)}${depth ? `&d=${depth}` : ""}`; }

function shieldTag() { return `<script src="/api/player/shield.js"></script>`; }

function rewriteHTML(html, baseURL, depth) {
  // 1. Strip <script src="...ad..."> and <iframe src="...ad..."> tags outright.
  html = html.replace(/<script\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')[^>]*>\s*<\/script>/gi, (tag, _q, dq, sq) => {
    const src = dq ?? sq ?? "";
    return isBlocked(src) ? "<!--seven-ad-stripped-->" : tag;
  });
  html = html.replace(/<iframe\b([^>]*)>/gi, (tag, attrs) => {
    const match = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const src = match ? (match[2] ?? match[3] ?? "") : "";
    return isBlocked(src) ? `<iframe${attrs.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*')/i, `src="about:blank"`)}>` : tag;
  });

  // 2. Rewrite subresources: provider assets route through /raw (same-origin), ad URLs are blanked,
  //    media/CDN URLs stay untouched. Root-relative paths (but not protocol-relative "//host") route too.
  const nextDepth = Number(depth || 0) + 1;
  html = html.replace(/\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi, (attr, name, _q, dq, sq) => {
    const value = dq ?? sq ?? "";
    if (!value || value.startsWith("#") || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("about:")) return attr;
    let resolved;
    try { resolved = new URL(value, baseURL).href; } catch { return attr; }
    if (isBlocked(resolved)) return `${name}="about:blank"`;
    if (MEDIA_FILE.test(resolved)) return attr;
    if (isRoutedHost(resolved) || /^\/(?!\/)/.test(value)) return `${name}="${rawURL(resolved, Math.min(nextDepth, 2))}"`;
    return attr;
  });

  // 3. Inject the shield last so the rewriter above can never touch it, first thing in <head>.
  html = html.replace(/<head([^>]*)>/i, (match, attrs) => `<head${attrs}>${shieldTag()}`) || `${shieldTag()}${html}`;
  return html;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https: data:",
  "connect-src 'self' blob: data: https: wss:",
  "font-src 'self' data: https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'"
].join("; ");

function htmlResponse(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP, "Cache-Control": "private, max-age=120", "Referrer-Policy": "no-referrer" } });
}

const SHIELD_SOURCE = `(function(){
  // The proxied frame is same-origin with SEVEN — replace real storage with a memory stub
  // BEFORE any provider code runs, so embedded scripts can never read session tokens.
  var mem = Object.create(null);
  var stub = { getItem:function(k){ return k in mem ? mem[k] : null; }, setItem:function(k,v){ mem[k] = String(v); }, removeItem:function(k){ delete mem[k]; }, clear:function(){ mem = Object.create(null); }, key:function(i){ return Object.keys(mem)[i] || null; } };
  Object.defineProperty(stub, "length", { get:function(){ return Object.keys(mem).length; } });
  ["localStorage", "sessionStorage"].forEach(function(name){ try { Object.defineProperty(window, name, { get:function(){ return stub; }, configurable:false }); } catch (e) {} });
  try { Object.defineProperty(document, "cookie", { get:function(){ return ""; }, set:function(){}, configurable:false }); } catch (e) {}
  var BLOCK = ${JSON.stringify(BLOCK_FRAGMENTS)};
  var ALLOW = ${JSON.stringify(ALLOW_HOSTS)};
  function bad(url){ try { var u = new URL(url, location.href); var h = u.hostname.toLowerCase(), s = u.href.toLowerCase();
    for (var i = 0; i < ALLOW.length; i++) { var a = ALLOW[i]; if (h === a || h.slice(-a.length - 1) === "." + a) return false; }
    for (var j = 0; j < BLOCK.length; j++) { if (h.indexOf(BLOCK[j]) !== -1 || s.indexOf(BLOCK[j]) !== -1) return true; }
    return false; } catch (e) { return false; } }
  // Never open popups or new tabs.
  window.open = function(){ return null; };
  // Block ad fetches silently.
  var of = window.fetch;
  if (of) window.fetch = function(input, init){ var u = typeof input === "string" ? input : (input && input.url) || ""; if (bad(u)) return Promise.resolve(new Response("", { status: 204 })); return of.apply(this, arguments); };
  var oo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u){ if (bad(u)) { arguments[1] = "data:text/plain,"; } return oo.apply(this, arguments); };
  // Neutralize scripts/iframes created with ad sources.
  ["HTMLScriptElement", "HTMLIFrameElement"].forEach(function(kind, idx){
    var proto = window[kind] && window[kind].prototype; if (!proto) return;
    var desc = Object.getOwnPropertyDescriptor(proto, "src"); if (!desc || !desc.set) return;
    Object.defineProperty(proto, "src", { set: function(v){ if (bad(v)) { return idx === 0 ? undefined : undefined; } desc.set.call(this, v); }, get: desc.get, configurable: true });
  });
  // Sweep anything the provider injects later.
  var sweep = function(root){ (root.querySelectorAll ? root.querySelectorAll("script[src],iframe[src]") : []).forEach(function(el){ if (el.src && bad(el.src)) el.remove(); }); };
  new MutationObserver(function(muts){ muts.forEach(function(m){ m.addedNodes.forEach(function(n){ if (n.nodeType !== 1) return; if ((n.tagName === "SCRIPT" || n.tagName === "IFRAME") && n.src && bad(n.src)) { n.remove(); return; } sweep(n); }); }); }).observe(document.documentElement || document, { childList: true, subtree: true });
  // Block forced navigations to ad hosts from anchors.
  document.addEventListener("click", function(e){ var a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if (a && a.href && (a.target === "_blank" || bad(a.href))) { e.preventDefault(); e.stopPropagation(); } }, true);
})();`;

export async function onRequestGet(context) {
  const request = context.request;
  const url = new URL(request.url);
  const path = (Array.isArray(context.params.path) ? context.params.path : [context.params.path || ""]).join("/");
  const env = context.env || {};

  if (path === "shield.js") {
    return new Response(SHIELD_SOURCE, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=14400", "Access-Control-Allow-Origin": "*" } });
  }

  if (path === "raw") {
    const target = url.searchParams.get("u") || "";
    if (!/^https?:\/\//i.test(target)) return new Response("", { status: 400 });
    const depth = Number(url.searchParams.get("d") || 0);
    if (isBlocked(target)) return new Response("", { status: 204, headers: { "Cache-Control": "public, max-age=86400" } });
    const provider = Object.keys(PROVIDERS).find(key => target.includes(PROVIDERS[key].replace("https://", ""))) || "vidlink";
    try {
      const upstream = await fetch(target, { headers: { "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0", "Accept": "*/*", "Referer": PROVIDERS[provider] + "/" }, redirect: "follow" });
      const type = upstream.headers.get("Content-Type") || "";
      if (type.includes("text/html")) {
        if (depth >= 2) return htmlResponse("<!doctype html><title>Blocked depth</title>", 200);
        const html = await upstream.text();
        return htmlResponse(rewriteHTML(html, upstream.url || target, depth));
      }
      const headers = new Headers({ "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" });
      ["Content-Type", "Content-Length", "Content-Encoding"].forEach(name => { const value = upstream.headers.get(name); if (value) headers.set(name, value); });
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return new Response("", { status: 204 });
    }
  }

  // /api/player/<provider>/<embed path + query>
  const slash = path.indexOf("/");
  const provider = slash === -1 ? path : path.slice(0, slash);
  const rest = slash === -1 ? "" : path.slice(slash + 1);
  const origin = PROVIDERS[provider];
  if (!origin) return htmlResponse("<!doctype html><title>Unknown player</title>", 404);
  const target = `${origin}/${rest}${url.search || ""}`;

  try {
    let cached = null;
    try { cached = await caches.default.match(request); } catch { /* caches API is Cloudflare-only; local dev skips it. */ }
    if (cached) return cached;
    const upstream = await fetch(target, { headers: { "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0", "Accept": "text/html,*/*", "Referer": origin + "/" }, redirect: "follow" });
    const type = upstream.headers.get("Content-Type") || "";
    if (!type.includes("text/html")) {
      // Static assets (JS/CSS/images) stream through with their true type; the CSP keeps them caged.
      const headers = new Headers({ "Content-Type": type || "application/octet-stream", "Cache-Control": "public, max-age=3600", "Content-Security-Policy": CSP, "Referrer-Policy": "no-referrer" });
      ["Content-Length", "Content-Encoding"].forEach(name => { const value = upstream.headers.get(name); if (value) headers.set(name, value); });
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    const html = await upstream.text();
    const response = htmlResponse(rewriteHTML(html, upstream.url || target, 0), upstream.status);
    try { context.waitUntil(caches.default.put(request, response.clone())); } catch { /* Local dev has no edge cache. */ }
    return response;
  } catch {
    return htmlResponse("<!doctype html><title>Player unavailable</title><p style=\"color:#ccc;font-family:sans-serif;background:#000;height:100%\">This player could not be loaded. Try another one from the menu.</p>", 502);
  }
}
