const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(web, "manifest.webmanifest"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("the launch ident and PWA files work from a project subpath", () => {
  assert.match(app, /startup-intro-mark" src="assets\/seven-wordmark-v2\.png"/);
  assert.match(app, /serviceWorker\.register\("service-worker\.js\?v=\d+",\s*\{ updateViaCache:"none" \}\)/);
  assert.doesNotMatch(index, /(?:href|src)="\//);
  assert.match(manifest, /"start_url": "\.\/"/);
  assert.match(manifest, /"scope": "\.\/"/);
  assert.match(serviceWorker, /const VERSION = "seven-v\d+"/);
  assert.match(serviceWorker, /const scopePath = new URL\(self\.registration\.scope\)\.pathname/);
});

test("iOS launch screens, page chrome, and intro use the same near-black base", () => {
  assert.match(index, /<meta name="theme-color" content="#050505"\s*\/>/);
  assert.match(manifest, /"background_color": "#050505"/);
  assert.match(manifest, /"theme_color": "#050505"/);
  assert.match(styles, /html\.seven-launching,html\.seven-launching body \{[^}]*linear-gradient\(180deg,#050505/);
  assert.match(styles, /\.seven-intro \{[^}]*background: #050505/);
  assert.doesNotMatch(index + manifest, /#071018/i);
  const splashImages = [...index.matchAll(/href="(assets\/splash\/[^\"]+\.png\?v=2)"/g)];
  assert.equal(splashImages.length, 24);
  for (const [, image] of splashImages) assert.ok(fs.existsSync(path.join(web, image.split("?")[0])), `${image} should exist`);
});
