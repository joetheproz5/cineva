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
const gateStart = app.indexOf("function profileGateShowcaseMarkup()");
const gateEnd = app.indexOf("function renderLoading()", gateStart);
const gate = app.slice(gateStart, gateEnd);

test("profile picker uses the animated, cinematic selector and keeps each profile selectable", () => {
  assert.match(gate, /profileGateShowcaseMarkup\(\)/);
  assert.match(gate, /class="profile-gate-brand-mark" src="assets\/seven-logo-red-download\.webp"/);
  assert.match(gate, /class="profile-gate-brand-orbit"/);
  assert.doesNotMatch(gate, /profile-gate-backdrop|data-profile-backdrop|profile-gate-poster|profile-gate-release/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-brand-mark \{ opacity: \.28;/);
  assert.match(styles, /transition: opacity 1\.1s ease, transform 1\.5s cubic-bezier\(\.2,\.75,\.25,1\)/);
  assert.match(app, /animationend", event => \{[\s\S]*?profile-gate-sheet-rise[\s\S]*?profile-gate-art-ready/);
  assert.match(gate, /profile-gate-brand-orbit/);
  assert.match(gate, /data-watch-profile=/);
  assert.match(gate, /showProfileUnlock\(profile\)/);
  assert.doesNotMatch(gate, /data-manage-profiles|class="manage-profiles"/);
});

test("profile picker has a working add-profile tile and does not exceed five profiles", () => {
  assert.match(gate, /account\.profiles\.length < 5[\s\S]*?data-add-profile-gate/);
  assert.match(gate, /account\.profiles\.length >= 3 \? "profile-gate-multirow"/);
  assert.match(gate, /account\.profiles\.length >= 5 \? "profile-gate-at-cap"/);
  assert.match(gate, /data-add-profile-gate[\s\S]*?showProfileEditor\("", "profiles", "profile"\)/);
  assert.match(app, /function showProfileEditor\(id = "", returnRoute = "account", initialCategory = "home"\)/);
  assert.match(app, /if \(!existing && state\.account\.profiles\.length >= 5\) return/);
  assert.match(app, /isNew && state\.profileSettingsReturn === "profiles"[\s\S]*?state\.route = "profiles"/);
});

test("desktop profile picker has no poster backdrop and softly spotlights the center", () => {
  assert.match(styles, /@media \(min-width: 651px\)[\s\S]*?\.profile-gate-showcase \{[\s\S]*?display: block/);
  assert.match(styles, /\.profile-gate \{ background: radial-gradient\(ellipse 48% 58% at 50% 52%, #211518/);
  assert.match(styles, /\.profile-gate-showcase > img:not\(\.profile-gate-brand-mark\) \{ display: none/);
  assert.match(styles, /\.profile-gate-showcase::before \{[^}]*background: radial-gradient\(ellipse at center, #6a202944/);
  assert.match(styles, /@keyframes profile-stage-glow/);
  assert.doesNotMatch(gate, /data-profile-art/);
  assert.match(styles, /\.profile-gate \.profile-chooser \{ display: flex; flex-wrap: wrap;[\s\S]*?gap: 22px/);
  assert.match(styles, /\.profile-gate \.profile-choice \.profile-avatar-guest \{[^}]*background: radial-gradient\(circle at 50% 35%, #16090b/);
  assert.match(styles, /\.profile-gate \.profile-avatar-guest img \{[^}]*width: 58%/);
  assert.match(app, /profile-avatar-guest[^>]*><img src="assets\/profile-person\.svg"/);
  assert.match(defaultProfileIcon, /class="bi bi-person-circle"/);
  assert.match(defaultProfileIcon, /fill="#ed1b27"/);
  assert.match(styles, /\.profile-gate \.profile-add-avatar \{[^}]*border: 1px solid #666a70/);
  assert.match(gate, /syncProfileGateLayout\(\)/);
  assert.match(app, /function profileGateAvatar\(profile\)[\s\S]*?profile-avatar-guest[\s\S]*?assets\/profile-person\.svg/);
});

test("profile selector uses SEVEN artwork instead of unrelated movie posters", () => {
  assert.match(gate, /assets\/seven-logo-red-download\.webp/);
  assert.match(gate, /profile-gate-brand-orbit/);
  assert.doesNotMatch(app, /function profileGateItems|profileGateReleaseLabel|data-profile-backdrop|profile-gate-carousel/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-brand-mark/);
  assert.match(styles, /animation: profile-stage-orbit 34s linear infinite/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.profile-gate-brand-orbit \{ animation: none; \}/);
});

test("startup fetches popular movies with a release date of today or later", () => {
  const catalogLoad = app.slice(app.indexOf("async function refreshCatalogNow()"), app.indexOf("function playMovieNow"));
  assert.match(catalogLoad, /api\("discover\/movie", \{ \.\.\.movieParams, "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(catalogLoad, /api\("discover\/movie", \{ "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.doesNotMatch(catalogLoad, /api\("movie\/upcoming"\)/);
});

test("mobile selector presents the SEVEN mark above the curved profile sheet", () => {
  assert.match(gate, /assets\/seven-logo-red-download\.webp/);
  assert.match(styles, /\.profile-gate-brand-mark \{ top: 40%; width: min\(76vw, 370px\); opacity: 0;/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-brand-mark \{ opacity: \.86;/);
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-brand-mark \{ opacity: 0; filter: brightness\(\.12\)/);
  assert.doesNotMatch(styles, /profile-gate-release|profile-gate-backdrop|profile-gate-carousel/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-logo \{ display: none/);
  assert.match(styles, /\.profile-gate-showcase \{[^}]*inset: 0 0 auto;[^}]*height: calc\(100% - 34svh\)/);
  assert.match(app, /function syncProfileGateLayout\(\)[\s\S]*?gate\.clientHeight - sheet\.offsetHeight/);
  assert.match(app, /new ResizeObserver\(syncProfileGateLayout\)/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{[^}]*min-height: max\(34svh, 300px\)/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{ min-height: max\(43svh, 290px\); max-height: 76svh/);
  assert.match(styles, /\.profile-gate \.profile-chooser \{ display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 18px 4px; width: min\(100%, 350px\)/);
  assert.match(styles, /\.profile-gate \.profile-choice-add \{ flex-basis: calc\(\(100% - 8px\) \/ 3\)/);
  assert.match(styles, /\.profile-gate-at-cap \.profile-chooser \{ gap: 18px 4px; width: min\(100%, 330px\)/);
  assert.match(styles, /\.profile-gate-at-cap \.profile-choice \{ flex-basis: calc\(\(100% - 8px\) \/ 3\)/);
  assert.match(styles, /\.profile-gate\.profile-gate-multirow \.profile-chooser \{ width: min\(100%, 440px\); row-gap: 28px/);
  assert.match(styles, /\.profile-gate-multirow \.profile-chooser \{ row-gap: 24px; \}/);
  assert.match(styles, /@media \(max-width: 650px\) and \(max-height: 690px\)[\s\S]*?\.profile-gate-brand-mark \{ width: min\(68vw, 330px\); \}/);
  assert.match(styles, /backdrop-filter: blur\(16px\)/);
  assert.match(styles, /\.profile-gate-showcase \{ height: calc\(100% - 43svh\); \}/);
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
  assert.match(styles, /profile-gate-selecting \.profile-gate-brand-mark \{ opacity: 0; filter: brightness\(\.12\)/);
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
  assert.match(index, /auth\.css\?v=271/);
  assert.match(index, /app\.js\?v=346/);
  assert.match(serviceWorker, /seven-v346/);
  assert.match(serviceWorker, /auth\.css\?v=271/);
  assert.match(serviceWorker, /app\.js\?v=346/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
  assert.match(serviceWorker, /assets\/seven-logo-red-download\.webp/);
});
