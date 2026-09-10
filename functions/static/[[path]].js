// Forward /static/* requests to vidsrc.sbs so the proxied player's runtime assets resolve.
const ORIGIN = "https://vidsrc.sbs";

export async function onRequestGet(context) {
  const rest = (Array.isArray(context.params.path) ? context.params.path.join("/") : context.params.path) || "";
  const target = `${ORIGIN}/static/${rest}${new URL(context.request.url).search}`;
  try {
    const upstream = await fetch(target, { headers: { "User-Agent": context.request.headers.get("User-Agent") || "Mozilla/5.0", "Referer": ORIGIN + "/" }, redirect: "follow" });
    const headers = new Headers({ "Cache-Control": "public, max-age=3600", "Referrer-Policy": "no-referrer" });
    ["Content-Type", "Content-Length", "Content-Encoding"].forEach(name => { const value = upstream.headers.get(name); if (value) headers.set(name, value); });
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response("", { status: 502 });
  }
}
