const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "auth.css"), "utf8");
const uiStyles = fs.readFileSync(path.join(web, "ui.css"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");
const defaultProfileIcon = fs.readFileSync(path.join(web, "assets/profile-person.svg"), "utf8");
const gateStart = app.indexOf("function profileGateItems()");
const gateEnd = app.indexOf("function renderLoading()", gateStart);
const gate = app.slice(gateStart, gateEnd);

test("profile picker uses the animated, cinematic selector and keeps each profile selectable", () => {
  assert.match(gate, /profileGateShowcaseMarkup\(items\)/);
  assert.match(gate, /data-profile-backdrop/);
  assert.match(gate, /data-profile-backdrop-next/);
  assert.match(gate, /\.profile-gate-backdrop:not\(\.is-active\)/);
  assert.match(gate, /function transitionProfileGateArtwork\(gate, item\)[\s\S]*?await next\.decode\(\)[\s\S]*?next\.classList\.add\("is-active"\)/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-backdrop\.is-active \{ opacity: \.98;/);
  assert.match(styles, /transition: opacity \.9s cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(app, /animationend", event => \{[\s\S]*?profile-gate-sheet-rise[\s\S]*?profile-gate-art-ready/);
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

test("desktop profile picker has no poster backdrop and softly spotlights the center", () => {
  assert.match(styles, /@media \(min-width: 651px\)[\s\S]*?\.profile-gate-showcase \{[\s\S]*?display: block/);
  assert.match(styles, /\.profile-gate \{ background: radial-gradient\(ellipse 48% 58% at 50% 52%, #211518/);
  assert.match(styles, /\.profile-gate-showcase > img, \.profile-gate-art-shade, \.profile-gate-feature, \.profile-gate-carousel \{ display: none/);
  assert.match(styles, /\.profile-gate-showcase::before \{[^}]*background: radial-gradient\(ellipse at center, #6a202944/);
  assert.match(styles, /@keyframes profile-stage-glow/);
  assert.doesNotMatch(gate, /data-profile-art/);
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
  assert.match(gate, /data-profile-backdrop/);
  assert.match(gate, /data-profile-backdrop \$\{first \?/);
  assert.match(gate, /\$\{item\.poster_path\}/);
  assert.match(gate, /data-profile-kind/);
  assert.match(gate, /data-profile-title/);
});

test("mobile picker fits a high-resolution portrait poster without cropping or branding", () => {
  assert.match(gate, /first\.poster_path/);
  assert.match(gate, /filter\(item => item\?\.poster_path\)/);
  assert.match(gate, /original/);
  assert.match(styles, /width: 100%; height: 100%; object-fit: contain; object-position: center bottom/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-logo \{ display: none/);
  assert.match(styles, /\.profile-gate-feature, \.profile-gate-carousel \{ display: none/);
  assert.match(styles, /\.profile-gate-showcase \{[^}]*inset: 0 0 auto;[^}]*height: calc\(100% - 39svh\)/);
  assert.match(app, /function syncProfileGateLayout\(\)[\s\S]*?gate\.clientHeight - sheet\.offsetHeight/);
  assert.match(app, /new ResizeObserver\(syncProfileGateLayout\)/);
  assert.match(styles, /\.profile-gate-backdrop \{[^}]*inset: 0;[^}]*width: 100%; height: 100%;[^}]*object-position: center bottom/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{[^}]*min-height: 39svh/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{ min-height: 50svh; max-height: 76svh/);
  assert.match(styles, /backdrop-filter: blur\(16px\)/);
  assert.match(styles, /\.profile-gate-showcase \{ height: calc\(100% - 50svh\); \}/);
});

test("mobile profile selection checks PIN first, then centers the selected avatar and waits for profile data", () => {
  assert.match(app, /function beginProfileGateSelection\(id\)/);
  assert.match(app, /rect\.top \+ rect\.height \/ 2 - window\.innerHeight \* \.46/);
  assert.match(gate, /beginProfileGateSelection\(profile\.id\)/);
  assert.match(app, /mobileHandoff:true/);
  assert.match(app, /profile-gate-handoff-avatar/);
  assert.match(app, /profile-gate-handoff-loading/);
  assert.match(app, /profileSecret\(pin\) !== profile\.pinHash[\s\S]*?beginProfileGateSelection\(profile\.id\)/);
  const activation = app.slice(app.indexOf("async function activateProfile("), app.indexOf("function beginProfileGateSelection("));
  assert.ok(activation.indexOf("await loadMyList(); await refreshCatalogForLanguage()") < activation.indexOf("enterHome();"));
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-sheet \{ animation: profile-gate-sheet-lower-away/);
  assert.match(styles, /@keyframes profile-gate-avatar-to-center/);
  assert.match(styles, /top: 46%; left: 50%; width: 86px; height: 86px; animation: profile-gate-avatar-to-center/);
  assert.match(styles, /profile-gate-selecting \.profile-gate-backdrop \{ opacity: 0; filter: brightness\(\.12\)/);
  assert.match(styles, /@keyframes profile-gate-loading-arrive/);
  assert.match(styles, /@keyframes profile-gate-exit-scene/);
  assert.match(activation, /if \(mobileHandoff\) state\.profileGateHomeEntry = true/);
  const home = app.slice(app.indexOf("function renderHome()"), app.indexOf("function heroNavigation()"));
  assert.match(home, /Boolean\(state\.profileGateHomeEntry\)/);
  assert.match(home, /state\.profileGateHomeEntry = false/);
  assert.match(home, /home-page \$\{animateProfileEntry \? "home-page-profile-entry"/);
  assert.match(uiStyles, /\.home-page-profile-entry \.hero \{ animation: home-profile-hero-enter/);
  assert.match(uiStyles, /\.home-page-profile-entry \.home-library \.rail \{ animation: home-profile-rail-enter/);
});

test("profile panel waits for the SEVEN ident, then rises; mobile uses a curved lower sheet", () => {
  assert.match(app, /querySelector\("\.profile-gate"\)\?\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\)/);
  assert.match(styles, /\.profile-gate-ready \.profile-gate-sheet \{ animation: profile-gate-desktop-rise/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-sheet \{[\s\S]*?border-radius: 48% 48% 0 0/);
  assert.match(styles, /profile-gate-sheet-rise/);
});

test("the redesigned selector assets are versioned for installed PWAs", () => {
  assert.match(index, /auth\.css\?v=264/);
  assert.match(index, /app\.js\?v=335/);
  assert.match(serviceWorker, /seven-v335/);
  assert.match(serviceWorker, /auth\.css\?v=264/);
  assert.match(serviceWorker, /app\.js\?v=335/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
});
