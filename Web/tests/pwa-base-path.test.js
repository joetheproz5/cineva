const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(web, "manifest.webmanifest"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");

test("the launch ident and PWA files work from a project subpath", () => {
  assert.match(app, /startup-intro-mark" src="assets\/seven-wordmark-v2\.png"/);
  assert.match(app, /serviceWorker\.register\("service-worker\.js\?v=\d+",\s*\{ updateViaCache:"none" \}\)/);
  assert.doesNotMatch(index, /(?:href|src)="\//);
  assert.match(manifest, /"start_url": "\.\/"/);
  assert.match(manifest, /"scope": "\.\/"/);
  assert.match(serviceWorker, /const VERSION = "seven-v\d+"/);
  assert.match(serviceWorker, /const scopePath = new URL\(self\.registration\.scope\)\.pathname/);
});
