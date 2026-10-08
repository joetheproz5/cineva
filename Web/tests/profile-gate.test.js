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

test("profile picker uses real cinematic poster art without a blown-up app icon", () => {
  assert.match(gate, /profileGateShowcaseMarkup\(\)/);
  assert.doesNotMatch(gate, /profile-gate-logo|seven-wordmark-v2\.png/);
  assert.match(gate, /class="profile-gate-poster" alt="" decoding="async" fetchpriority="high"/);
  assert.doesNotMatch(gate, /profile-gate-brand-mark|profile-gate-brand-orbit|seven-logo-red-download\.webp/);
  assert.match(app, /function profileGatePosterCandidates\(\)[\s\S]*?state\.catalog\["Coming soon"\]/);
  assert.match(app, /release_date \|\| ""\) >= today/);
  assert.match(app, /function startProfileGatePosterRotation\(\)/);
  assert.match(app, /TMDB_PROFILE_POSTER/);
  assert.match(app, /images\[nextImage\]\.classList\.add\("is-visible"\)/);
  assert.match(app, /loadProfileGatePoster\(images\[nextImage\], items\[nextItem\]\)/);
  assert.match(app, /data-watch-profile=/);
  assert.match(gate, /showProfileUnlock\(profile\)/);
  assert.doesNotMatch(gate, /data-manage-profiles|class="manage-profiles"/);
  assert.match(styles, /\.profile-gate-poster\.is-visible \{ opacity: \.92;/);
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-poster \{ opacity: 0;/);
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

test("desktop profile picker keeps a restrained center spotlight and no mobile poster", () => {
  assert.match(styles, /@media \(min-width: 651px\)[\s\S]*?\.profile-gate-showcase \{[\s\S]*?display: block/);
  assert.match(styles, /\.profile-gate \{ background: radial-gradient\(ellipse 48% 58% at 50% 52%, #211518/);
  assert.match(styles, /\.profile-gate-showcase \.profile-gate-poster \{ display: none/);
  assert.match(styles, /\.profile-gate-showcase::before \{[^}]*background: radial-gradient\(ellipse at center, #6a202944/);
  assert.match(styles, /@keyframes profile-stage-glow/);
  assert.match(styles, /\.profile-gate \.profile-chooser \{ display: flex; flex-wrap: wrap;[\s\S]*?gap: 22px/);
  assert.match(styles, /\.profile-gate \.profile-choice \.profile-avatar-guest \{[^}]*background: radial-gradient\(circle at 50% 35%, #16090b/);
  assert.match(styles, /\.profile-gate \.profile-avatar-guest img \{[^}]*width: 58%/);
  assert.match(app, /profile-avatar-guest[^>]*><img src="assets\/profile-person\.svg"/);
  assert.match(defaultProfileIcon, /class="bi bi-person-circle"/);
  assert.match(defaultProfileIcon, /fill="#ed1b27"/);
  assert.match(styles, /\.profile-gate \.profile-add-avatar \{[^}]*border: 1px solid #666a70/);
  assert.match(app, /function profileGateAvatar\(profile\)[\s\S]*?profile-avatar-guest[\s\S]*?assets\/profile-person\.svg/);
});

test("mobile artwork is one uncropped-feeling poster at a time with a clean handoff", () => {
  assert.match(styles, /\.profile-gate-poster \{[^}]*width: min\(118vw, 60svh\); height: 90svh;[^}]*object-fit: cover/);
  assert.match(styles, /mask-image: linear-gradient\(180deg, #000 0%, #000 54%, #000c 68%, transparent 91%\)/);
  assert.match(styles, /\.profile-gate-showcase::after \{[^}]*linear-gradient\(180deg,[^}]*#050506 86%/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{[^}]*min-height: max\(40svh, 326px\)/);
  assert.match(styles, /backdrop-filter: blur\(24px\) saturate\(1\.18\)/);
  assert.doesNotMatch(styles, /\.profile-gate-logo/);
  assert.match(styles, /\.profile-gate-at-cap \.profile-chooser \{ gap: 15px 4px; width: min\(100%, 330px\)/);
  assert.match(styles, /\.profile-gate-multirow \.profile-chooser \{ row-gap: 17px; \}/);
  assert.match(app, /function syncProfileGateLayout\(\)[\s\S]*?showcase\.style\.height = `\$\{gate\.clientHeight\}px`/);
  assert.match(app, /new ResizeObserver\(syncProfileGateLayout\)/);
  assert.match(app, /function stopProfileGatePosterRotation\(\)[\s\S]*?clearTimeout\(profileGatePosterTimer\)/);
  assert.match(app, /stopProfileGatePosterRotation\(\);\s*gate\.classList\.add\("profile-gate-selecting"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.profile-gate-poster \{ animation: none; transition-duration: \.01ms; \}/);
});

test("startup only uses upcoming releases for the poster rotation when available", () => {
  const catalogLoad = app.slice(app.indexOf("async function refreshCatalogNow()"), app.indexOf("function playMovieNow"));
  assert.match(catalogLoad, /api\("discover\/movie", \{ \.\.\.movieParams, "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(catalogLoad, /api\("discover\/movie", \{ "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(app, /const eligible = upcoming\.filter\(item => item\.poster_path && String\(item\.release_date \|\| ""\) >= today\)/);
  assert.doesNotMatch(catalogLoad, /api\("movie\/upcoming"\)/);
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
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-poster \{ opacity: 0;/);
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

test("profile panel waits for the SEVEN ident, then rises into a curved lower sheet", () => {
  assert.match(app, /querySelector\("\.profile-gate"\)\?\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\)/);
  assert.match(styles, /\.profile-gate-ready \.profile-gate-sheet \{ animation: profile-gate-desktop-rise/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-sheet \{[\s\S]*?border-radius: 44% 44% 0 0/);
  assert.match(styles, /profile-gate-sheet-rise/);
});

test("the redesigned selector assets are versioned for installed PWAs", () => {
  assert.match(index, /auth\.css\?v=273/);
  assert.match(index, /app\.js\?v=351/);
  assert.match(serviceWorker, /seven-v351/);
  assert.match(serviceWorker, /auth\.css\?v=273/);
  assert.match(serviceWorker, /app\.js\?v=351/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
});
