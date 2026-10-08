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
  assert.match(gate, /class="profile-gate-slide"[\s\S]*?class="profile-gate-poster" alt="" decoding="async"/);
  assert.match(gate, /fetchpriority=\\"high\\"/);
  assert.doesNotMatch(gate, /profile-gate-brand-mark|profile-gate-brand-orbit|seven-logo-red-download\.webp/);
  assert.match(app, /function profileGatePosterCandidates\(\)[\s\S]*?state\.catalog\["Coming soon"\]/);
  assert.match(app, /release_date \|\| ""\) >= today/);
  assert.match(app, /function startProfileGatePosterRotation\(\)/);
  assert.match(app, /TMDB_PROFILE_POSTER/);
  assert.match(app, /const TMDB_PROFILE_POSTER = "https:\/\/image\.tmdb\.org\/t\/p\/w1280"/);
  assert.match(app, /images\[nextImage\]\.classList\.add\("is-visible"\)/);
  assert.match(app, /loadProfileGatePoster\(images\[nextImage\], items\[nextItem\]\)/);
  assert.match(app, /data-watch-profile=/);
  assert.match(gate, /showProfileUnlock\(profile\)/);
  assert.doesNotMatch(gate, /data-manage-profiles|class="manage-profiles"/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-slide\.is-visible \{ opacity: 1; \}/);
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-slide\.is-visible \{ opacity: 0;/);
});

test("profile picker has a working add-profile tile and does not exceed five profiles", () => {
  assert.match(gate, /account\.profiles\.length < 5[\s\S]*?data-add-profile-gate/);
  assert.match(gate, /account\.profiles\.length >= 3 \? "profile-gate-multirow"/);
  assert.match(gate, /account\.profiles\.length >= 5 \? "profile-gate-at-cap"/);
  assert.match(gate, /data-add-profile-gate[\s\S]*?showProfileEditor\("", "profiles", "profile"\)/);
  assert.match(app, /function showProfileEditor\(id = "", returnRoute = "account", initialCategory = "home"\)/);
  assert.match(app, /if \(!existing && state\.account\.profiles\.length >= 5\) return/);
  assert.match(app, /if \(category === "taste" && state\.profileCreationReturn\) \{[\s\S]*?const returnRoute = state\.profileCreationReturn;[\s\S]*?state\.route = returnRoute/);
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

test("mobile artwork is a sharp portrait poster with a cinematic color wash and a calm release cue", () => {
  assert.match(styles, /\.profile-gate-poster \{[^}]*width: min\(100vw, 58svh\); height: min\(87svh, 150vw\);[^}]*object-fit: contain/);
  assert.match(styles, /\.profile-gate-slide::before \{[^}]*filter: blur\(34px\) saturate\(1\.35\) brightness\(\.58\)/);
  assert.match(styles, /\.profile-gate-slide\.is-visible \.profile-gate-poster \{ transform: translateX\(-50%\) scale\(1\.03\); \}/);
  assert.match(styles, /\.profile-gate-art-ready \.profile-gate-slide\.is-visible \.profile-gate-release:not\(\[hidden\]\) \{ opacity: \.94;/);
  assert.match(styles, /bottom: calc\(var\(--profile-gate-sheet-height, 326px\) \+ 13px\)/);
  assert.match(styles, /\.profile-gate-slide::after \{[^}]*linear-gradient\(180deg,[^}]*#050506 87%/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{[^}]*min-height: max\(40svh, 326px\)/);
  assert.match(styles, /backdrop-filter: blur\(24px\) saturate\(1\.18\)/);
  assert.doesNotMatch(styles, /\.profile-gate-logo/);
  assert.match(styles, /\.profile-gate-at-cap \.profile-chooser \{ gap: 15px 4px; width: min\(100%, 330px\)/);
  assert.match(styles, /\.profile-gate-multirow \.profile-chooser \{ row-gap: 17px; \}/);
  assert.match(app, /function syncProfileGateLayout\(\)[\s\S]*?showcase\.style\.height = `\$\{gate\.clientHeight\}px`/);
  assert.match(app, /gate\.style\.setProperty\("--profile-gate-sheet-height", `\$\{sheet\.offsetHeight\}px`\)/);
  assert.match(app, /new ResizeObserver\(syncProfileGateLayout\)/);
  assert.match(app, /function stopProfileGatePosterRotation\(\)[\s\S]*?clearTimeout\(profileGatePosterTimer\)/);
  assert.match(app, /stopProfileGatePosterRotation\(\);\s*gate\.classList\.add\("profile-gate-selecting"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.profile-gate-poster, \.profile-gate-slide, \.profile-gate-release \{ animation: none; transition-duration: \.01ms; \}/);
  assert.match(app, /function setProfileGateSlide\([\s\S]*?dateKey < profileGateDateKey\(\)/);
});

test("startup only uses upcoming releases for the poster rotation when available", () => {
  const catalogLoad = app.slice(app.indexOf("async function refreshCatalogNow()"), app.indexOf("function playMovieNow"));
  assert.match(catalogLoad, /api\("discover\/movie", \{ \.\.\.movieParams, "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(catalogLoad, /api\("discover\/movie", \{ "primary_release_date\.gte":profileGateDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(app, /const eligible = upcoming\.filter\(item => item\.poster_path && String\(item\.release_date \|\| ""\) >= today\)/);
  assert.doesNotMatch(catalogLoad, /api\("movie\/upcoming"\)/);
});

test("profile selection checks PIN first, centers the selected avatar, and waits for profile data", () => {
  assert.match(app, /function beginProfileGateSelection\(id\)/);
  assert.match(app, /const centerY = window\.matchMedia\("\(max-width: 650px\)"\)\.matches \? \.46 : \.5/);
  assert.match(app, /rect\.top \+ rect\.height \/ 2 - window\.innerHeight \* centerY/);
  assert.match(gate, /beginProfileGateSelection\(profile\.id\)/);
  assert.match(app, /handoff:true/);
  assert.match(app, /profile-gate-handoff-avatar/);
  assert.match(app, /profile-gate-handoff-loading/);
  assert.match(app, /profileSecret\(pin\) !== profile\.pinHash[\s\S]*?beginProfileGateSelection\(profile\.id\)/);
  const activation = app.slice(app.indexOf("async function activateProfile("), app.indexOf("function beginProfileGateSelection("));
  assert.ok(activation.indexOf("await loadMyList(); await refreshCatalogForLanguage()") < activation.indexOf("enterHome();"));
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-sheet \{ animation: profile-gate-sheet-lower-away/);
  assert.match(styles, /@keyframes profile-gate-avatar-to-center/);
  assert.match(styles, /top: 46%; left: 50%; width: 86px; height: 86px; animation: profile-gate-avatar-to-center/);
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-slide\.is-visible \{ opacity: 0;/);
  assert.match(styles, /@keyframes profile-gate-loading-arrive/);
  assert.match(styles, /@keyframes profile-gate-exit-scene/);
  assert.match(activation, /if \(handoff\) state\.profileGateHomeEntry = true/);
  const home = app.slice(app.indexOf("function renderHome()"), app.indexOf("function heroNavigation()"));
  assert.match(home, /Boolean\(state\.profileGateHomeEntry\)/);
  assert.match(home, /state\.profileGateHomeEntry = false/);
  assert.match(home, /home-page \$\{animateProfileEntry \? "home-page-profile-entry"/);
  assert.match(uiStyles, /\.home-page-profile-entry \.hero \{ animation: profile-home-fade-in \.48s ease both; \}/);
  assert.match(uiStyles, /\.home-page-profile-entry \.home-library \{ animation: profile-home-fade-in \.48s \.1s ease both; \}/);
  assert.match(uiStyles, /\.home-page-profile-entry \.home-library \.rail \{ animation: none; \}/);
  assert.match(uiStyles, /\.home-page-profile-entry \.home-hero-backdrop \{ animation: profile-home-fade-in \.48s ease both; \}/);
  assert.match(uiStyles, /@keyframes profile-home-fade-in \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  assert.doesNotMatch(uiStyles.slice(uiStyles.indexOf(".home-page-profile-entry .hero"), uiStyles.indexOf(".home-page .hero")), /translateY|scale\(/);
});

test("desktop profile selection uses the centered loading handoff and fades the chooser away", () => {
  const desktopStart = styles.indexOf("@media (min-width: 651px)", styles.indexOf("/* Cinematic profile handoff"));
  const desktopGate = styles.slice(desktopStart, styles.indexOf("@media (max-width: 650px)", desktopStart));
  assert.match(desktopGate, /\.profile-gate-selecting \.profile-gate-sheet \{ animation: profile-gate-desktop-sheet-away/);
  assert.match(desktopGate, /\.profile-gate-selecting \.profile-gate-showcase \{ opacity: \.28/);
  assert.match(desktopGate, /\.profile-gate-handoff-avatar \{ position: absolute; top: 50%; left: 50%; width: 104px/);
  assert.match(desktopGate, /\.profile-gate-handoff-loading \{ position: absolute; top: calc\(50% \+ 76px\)/);
  assert.match(desktopGate, /@keyframes profile-gate-desktop-avatar-to-center/);
  assert.match(desktopGate, /@keyframes profile-gate-desktop-loading-arrive/);
  assert.match(desktopGate, /@keyframes profile-gate-desktop-exit-scene/);
});

test("reduced-motion users get a settled profile handoff instead of a half-animation", () => {
  const reducedMotionStart = styles.indexOf("@media (prefers-reduced-motion: reduce)", styles.indexOf("@keyframes profile-gate-exit-scene"));
  const reducedMotion = styles.slice(reducedMotionStart, styles.indexOf("\n}", reducedMotionStart));
  assert.match(reducedMotion, /\.profile-gate-selecting \.profile-gate-sheet \{ animation: none !important; visibility: hidden; opacity: 0; \}/);
  assert.match(reducedMotion, /\.profile-gate-handoff-avatar \{ animation: none !important; opacity: 1; transform: translate\(-50%, -50%\); \}/);
  assert.match(reducedMotion, /\.profile-gate-handoff-loading \{ animation: none !important; opacity: 1; transform: translateX\(-50%\); \}/);
  assert.match(reducedMotion, /\.profile-gate-handoff-loading \.profile-gate-spinner \{ border-color: #ed1b27; animation: none !important; \}/);
  assert.match(reducedMotion, /\.profile-gate-handoff-exit \{ animation: none !important; opacity: 0; \}/);
  const uiReducedMotion = uiStyles.slice(uiStyles.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(uiReducedMotion, /\.home-hero-backdrop \{ opacity: 1; transform: none; animation: none !important; \}/);
  assert.doesNotMatch(uiReducedMotion, /home-hero-image \.75s/);
});

test("profile panel waits for the SEVEN ident, then rises into a curved lower sheet", () => {
  assert.match(app, /querySelector\("\.profile-gate"\)\?\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\)/);
  assert.match(styles, /\.profile-gate-ready \.profile-gate-sheet \{ animation: profile-gate-desktop-rise/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-sheet \{[\s\S]*?border-radius: 44% 44% 0 0/);
  assert.match(styles, /profile-gate-sheet-rise/);
});

test("the redesigned selector assets are versioned for installed PWAs", () => {
  assert.match(index, /auth\.css\?v=276/);
  assert.match(index, /app\.js\?v=356/);
  assert.match(serviceWorker, /seven-v357/);
  assert.match(serviceWorker, /auth\.css\?v=276/);
  assert.match(serviceWorker, /app\.js\?v=356/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
});
