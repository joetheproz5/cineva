const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const web = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");

test("in-app routes create same-page history entries and restore the prior view", () => {
  assert.match(app, /history\.replaceState\(appNavigationEntry\(0\)/);
  assert.match(app, /history\.pushState\(appNavigationEntry\(appNavigationIndex\)/);
  assert.match(app, /window\.addEventListener\("popstate", restoreAppNavigation\)/);
  assert.match(app, /Object\.assign\(state, snapshot\.values, \{ route:snapshot\.route \}\)/);
  assert.match(app, /window\.scrollTo\(snapshot\.scrollX, snapshot\.scrollY\)/);
  assert.match(app, /history\.scrollRestoration = "manual"/);
  assert.doesNotMatch(app, /history\.replaceState\(null/);
});

test("history entries distinguish detail pages and retain their view data", () => {
  assert.match(app, /route === "movie"\) return `\$\{route\}:\$\{state\.movie\?\.id/);
  assert.match(app, /route === "series"\) return `\$\{route\}:\$\{state\.series\?\.id/);
  assert.match(app, /route === "player"\) return `\$\{route\}:\$\{state\.player\?\.type/);
  assert.match(app, /"movie", "series", "person"[\s\S]*?"browse", "allCatalog", "exploreView"/);
  assert.match(app, /function resetAppNavigation\(\)/);
  assert.match(app, /resetAppNavigation\(\);\s*state\.route = "profiles"/);
  assert.match(app, /function signOut\(\) \{ clearSession\(\); resetAppNavigation\(\)/);
});

test("phone and desktop back controls pop app history instead of leaving the site", () => {
  assert.match(app, /history\.state\?\.sevenNavigation\?\.index === appNavigationIndex && appNavigationIndex > 0[\s\S]*?history\.back\(\)/);
  assert.ok(app.includes("/^data-(?:back(?:-|$)|.+-back$)/"));
  assert.match(app, /event\.stopImmediatePropagation\(\);\s*history\.back\(\)/);
  assert.match(app, /data-onboarding-back/);
});

test("the installed PWA receives the navigation-history fix from the versioned shell", () => {
  assert.match(index, /app\.js\?v=352/);
  assert.match(worker, /seven-v352/);
  assert.match(worker, /app\.js\?v=352/);
  assert.match(app, /service-worker\.js\?v=352/);
});
