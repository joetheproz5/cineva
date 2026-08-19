const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
const server = http.createServer((request, response) => {
  const requested = decodeURIComponent(request.url.split("?")[0]).replace(/^[\\/]+/, "");
  const safePath = path.normalize(requested).replace(/^([.][.][\\/])+/, "");
  const file = path.join(root, safePath === "." ? "index.html" : safePath);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  fs.readFile(file, (error, data) => { if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" }); response.end(data); });
});
const port = process.env.PORT || 4174;
server.listen(port, "0.0.0.0", () => console.log(`Cineva is available on port ${port}`));
