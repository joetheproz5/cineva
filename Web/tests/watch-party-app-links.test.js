const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "..", "..");
const app = fs.readFileSync(path.join(repository, "Web", "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(repository, "Web", "manifest.webmanifest"), "utf8"));
const androidMain = fs.readFileSync(path.join(repository, "Android", "app", "src", "main", "java", "com", "example", "cineva", "MainActivity.kt"), "utf8");
const androidManifest = fs.readFileSync(path.join(repository, "Android", "app", "src", "main", "AndroidManifest.xml"), "utf8");

test("watch-party invite links are canonical, scoped URLs with the current title", () => {
  assert.match(app, /function partyInviteURL\(code\)\s*\{\s*const url = new URL\("\.\/", window\.location\.href\)/);
  assert.match(app, /url\.searchParams\.set\("watch", code\)/);
  assert.match(app, /state\.player\.type === "tv" \? `tv:/);
  assert.match(app, /const inviteURL = partyInviteURL\(party\.code\)\.href/);
  assert.match(app, /state\.pendingWatch = params\.get\("watch"\)/);
  assert.match(app, /if \(state\.pendingWatch && deep\)/);
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.launch_handler.client_mode, "navigate-existing");
});

test("Android receives app links on launch and when an existing app is opened", () => {
  assert.match(androidManifest, /android:launchMode="singleTop"/);
  assert.match(androidMain, /loadUrl\(supportedAppLink\(intent\?\.dataString\) \?: APP_URL\)/);
  assert.match(androidMain, /override fun onNewIntent\(intent: Intent\)[\s\S]*?supportedAppLink\(intent\.dataString\)\?\.let \{ web\.loadUrl\(it\) \}/);
  assert.match(androidMain, /internal fun supportedAppLink\(rawUrl: String\?\): String\?/);
  assert.match(androidMain, /uri\.host\?\.equals\(APP_HOST, ignoreCase = true\) != true/);
});
