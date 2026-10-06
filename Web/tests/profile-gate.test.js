const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "auth.css"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");
const defaultProfileIcon = fs.readFileSync(path.join(web, "assets/profile-person.svg"), "utf8");
const gateStart = app.indexOf("function profileGateItems()");
const gateEnd = app.indexOf("function renderLoading()", gateStart);
const gate = app.slice(gateStart, gateEnd);

test("profile picker uses the animated, cinematic selector and keeps each profile selectable", () => {
  assert.match(gate, /profileGateShowcaseMarkup\(items\)/);
  assert.match(gate, /data-profile-backdrop/);
  assert.match(gate, /data-profile-track/);
  assert.match(gate, /data-watch-profile=/);
  assert.match(gate, /showProfileUnlock\(profile\)/);
  assert.doesNotMatch(gate, /data-manage-profiles|class="manage-profiles"/);
});

test("profile picker has a working add-profile tile and does not exceed five profiles", () => {
  assert.match(gate, /account\.profiles\.length < 5[\s\S]*?data-add-profile-gate/);
  assert.match(gate, /data-add-profile-gate[\s\S]*?showProfileEditor\("", "profiles", "profile"\)/);
  assert.match(app, /function showProfileEditor\(id = "", returnRoute = "account", initialCategory = "home"\)/);
  assert.match(app, /if \(!existing && state\.account\.profiles\.length >= 5\) return/);
  assert.match(app, /isNew && state\.profileSettingsReturn === "profiles"[\s\S]*?state\.route = "profiles"/);
});

test("desktop profile picker rotates one full-screen movie poster behind the centered profiles", () => {
  assert.match(styles, /@media \(min-width: 651px\)[\s\S]*?\.profile-gate-showcase \{[\s\S]*?display: block/);
  assert.match(styles, /\.profile-gate-art-backdrop \{[^}]*position: absolute; inset: 0;[^}]*object-fit: cover;[^}]*filter: blur\(15px\)/);
  assert.match(styles, /\.profile-gate \{[^}]*background: radial-gradient\(ellipse 48% 66% at 50% 53%, #241519/);
  assert.match(styles, /\.profile-gate-showcase > img:not\(\.profile-gate-art-backdrop\), \.profile-gate-art-shade, \.profile-gate-feature, \.profile-gate-carousel \{ display: none/);
  assert.match(styles, /\.profile-gate-changing \.profile-gate-art-backdrop \{ opacity: \.62/);
  assert.match(styles, /radial-gradient\(ellipse 48% 44% at 50% 52%, #050607d9/);
  assert.match(styles, /\.profile-gate \.profile-chooser \{ display: flex; flex-wrap: wrap;[\s\S]*?gap: 30px/);
  assert.match(styles, /\.profile-gate \.profile-choice \.profile-avatar-guest \{[^}]*background: radial-gradient\(circle at 50% 35%, #16090b/);
  assert.match(styles, /\.profile-gate \.profile-avatar-guest img \{[^}]*width: 58%/);
  assert.match(app, /profile-avatar-guest[^>]*><img src="assets\/profile-person\.svg"/);
  assert.match(defaultProfileIcon, /class="bi bi-person-circle"/);
  assert.match(defaultProfileIcon, /fill="#ed1b27"/);
  assert.match(styles, /\.profile-gate \.profile-add-avatar \{[^}]*border: 1px solid #666a70/);
  assert.match(gate, /positionProfileGateCarousel\(\)/);
  assert.match(app, /function profileGateAvatar\(profile\)[\s\S]*?profile-avatar-guest[\s\S]*?assets\/profile-person\.svg/);
});

test("profile showcase artwork rotates from the loaded catalogue and respects reduced motion", () => {
  assert.match(gate, /state\.featuredPool/);
  assert.match(gate, /setInterval\(\(\) =>/);
  assert.match(gate, /prefers-reduced-motion: reduce/);
  assert.match(gate, /data-profile-art/);
  assert.match(gate, /data-profile-art \$\{first \?/);
  assert.match(gate, /\$\{item\.backdrop_path\}/);
  assert.match(gate, /\/w1280\//);
  assert.match(gate, /data-profile-kind/);
  assert.match(gate, /data-profile-title/);
});

test("profile panel waits for the SEVEN ident, then rises; mobile uses a curved lower sheet", () => {
  assert.match(app, /querySelector\("\.profile-gate"\)\?\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\)/);
  assert.match(styles, /\.profile-gate-ready \.profile-gate-sheet \{ animation: profile-gate-desktop-rise/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-sheet \{[\s\S]*?border-radius: 48% 48% 0 0/);
  assert.match(styles, /profile-gate-sheet-rise/);
});

test("the redesigned selector assets are versioned for installed PWAs", () => {
  assert.match(index, /auth\.css\?v=254/);
  assert.match(index, /app\.js\?v=324/);
  assert.match(serviceWorker, /seven-v324/);
  assert.match(serviceWorker, /auth\.css\?v=254/);
  assert.match(serviceWorker, /app\.js\?v=324/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
});
