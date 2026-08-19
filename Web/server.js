const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const configPath = path.join(root, "tmdb.local.json");
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
const allowed = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|now_playing|\d+)|tv\/(popular|on_the_air|\d+(\/season\/\d+)?)|search\/(multi|movie|tv)|discover\/(movie|tv))$/;

function bearerToken() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")).bearerToken; } catch { return process.env.TMDB_BEARER_TOKEN; }
}
function sendJSON(response, status, payload) { response.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }); response.end(JSON.stringify(payload)); }
async function proxyTMDB(request, response, sourceURL) {
  const endpoint = sourceURL.pathname.replace(/^\/api\/tmdb\//, "");
  if (!allowed.test(endpoint)) return sendJSON(response, 400, { error:"Unsupported TMDB endpoint." });
  const token = bearerToken();
  if (!token) return sendJSON(response, 503, { error:"TMDB token missing. Create Web/tmdb.local.json from the example file." });
  try {
    const upstream = await fetch(`https://api.themoviedb.org/3/${endpoint}${sourceURL.search}`, { headers:{ Authorization:`Bearer ${token}`, accept:"application/json" } });
    const data = await upstream.text();
    response.writeHead(upstream.status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"public, max-age=300" }); response.end(data);
  } catch { sendJSON(response, 502, { error:"TMDB is temporarily unavailable." }); }
}
const server = http.createServer((request, response) => {
  const sourceURL = new URL(request.url, "http://localhost");
  if (sourceURL.pathname.startsWith("/api/tmdb/")) return proxyTMDB(request, response, sourceURL);
  const requested = decodeURIComponent(sourceURL.pathname).replace(/^[\\/]+/, "");
  const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, "");
  const file = path.join(root, safePath === "." ? "index.html" : safePath);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, data) => { if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); response.writeHead(200, { "Content-Type":types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" }); response.end(data); });
});
const port = process.env.PORT || 4174;
server.listen(port, "0.0.0.0", () => console.log(`Cineva is available on port ${port}`));
