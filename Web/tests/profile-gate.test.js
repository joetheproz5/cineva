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

test("profile picker keeps a clean spotlight and contains no replacement artwork", () => {
  assert.match(gate, /profileGateShowcaseMarkup\(\)/);
  assert.doesNotMatch(gate, /profile-gate-logo|seven-wordmark-v2\.png/);
  assert.match(gate, /return `<div class="profile-gate-showcase" aria-hidden="true"><\/div>`/);
  assert.doesNotMatch(gate, /profile-gate-art|gate-seven-shape|gate-ruby|poster|TMDB|seven-wordmark/);
  assert.doesNotMatch(app, /TMDB_PROFILE_POSTER|profileGatePoster|profile-gate-poster|profile-gate-slide|profile-gate-release/);
  assert.doesNotMatch(app, /profile-gate-art|gate-seven-shape/);
  assert.match(app, /data-watch-profile=/);
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
  assert.match(app, /if \(category === "taste" && state\.profileCreationReturn\) \{[\s\S]*?const returnRoute = state\.profileCreationReturn;[\s\S]*?state\.route = returnRoute/);
});

test("desktop profile picker keeps a restrained center spotlight and no mobile poster", () => {
  assert.match(styles, /@media \(min-width: 651px\)[\s\S]*?\.profile-gate-showcase \{[\s\S]*?display: block/);
  assert.match(styles, /\.profile-gate \{ background: radial-gradient\(ellipse 48% 58% at 50% 52%, #211518/);
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

test("mobile profile screen keeps the simple middle glow and existing profile sheet", () => {
  assert.doesNotMatch(styles, /profile-gate-art|gate-seven-shape|profile-gate-ribbon/);
  assert.match(styles, /\.profile-gate-showcase \{ position: absolute; z-index: 0; inset: 0; display: block; height: 100%;/);
  assert.match(styles, /\.profile-gate-showcase::before \{[^}]*radial-gradient\(ellipse 72% 58% at 50% 27%/);
  assert.match(styles, /\.profile-gate \.profile-gate-sheet \{[^}]*min-height: max\(40svh, 326px\)/);
  assert.match(styles, /background: linear-gradient\(180deg, #111215df 0%, #09090aeb 46%, #070708f2 100%\)/);
  assert.match(styles, /backdrop-filter: blur\(18px\) saturate\(1\.16\)/);
  assert.match(app, /scene\.classList\.add\("profile-gate-startup-scene"\);\s*profileGate\.appendChild\(scene\)/);
  assert.match(styles, /\.profile-gate-startup-scene \{ position: fixed; z-index: 1; inset: 0; display: grid; width: 100vw; height: 100svh/);
  assert.match(styles, /\.profile-gate-startup-scene\.profile-picked \{ opacity: 0; transition: opacity \.28s ease; \}/);
  assert.doesNotMatch(styles, /profile-gate-startup-glow/);
  assert.match(uiStyles, /\.startup-intro-stage \{[^}]*animation: intro-stage-light 2\.3s ease-out both/);
  assert.match(uiStyles, /\.startup-intro-atmosphere \{[^}]*animation: intro-atmosphere 2\.4s ease-out \.1s both/);
  assert.doesNotMatch(styles, /\.profile-gate-logo/);
  assert.match(styles, /\.profile-gate-at-cap \.profile-chooser \{ gap: 15px 4px; width: min\(100%, 330px\)/);
  assert.match(styles, /\.profile-gate-multirow \.profile-chooser \{ row-gap: 17px; \}/);
  assert.doesNotMatch(app, /profileGateResize|profileGateLayout|profileGatePoster/);
});

test("home release discovery stays date-filtered independently from profile selection", () => {
  const catalogLoad = app.slice(app.indexOf("async function refreshCatalogNow()"), app.indexOf("function playMovieNow"));
  assert.match(catalogLoad, /api\("discover\/movie", \{ \.\.\.movieParams, "primary_release_date\.gte":localDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.match(catalogLoad, /api\("discover\/movie", \{ "primary_release_date\.gte":localDateKey\(\), sort_by:"popularity\.desc" \}\)/);
  assert.doesNotMatch(app, /profileGatePoster|TMDB_PROFILE_POSTER/);
  assert.doesNotMatch(catalogLoad, /api\("movie\/upcoming"\)/);
});

test("profile selection checks PIN first, centers the selected avatar, and waits for profile data", () => {
  assert.match(app, /function beginProfileGateSelection\(id\)/);
  assert.match(app, /const centerY = window\.matchMedia\("\(max-width: 650px\)"\)\.matches \? \.46 : \.5/);
  assert.match(app, /rect\.top \+ rect\.height \/ 2 - window\.innerHeight \* centerY/);
  assert.match(gate, /beginProfileGateSelection\(profile\.id\)/);
  assert.match(app, /function releaseProfileGateIntro\(\)[\s\S]*?scene\.classList\.add\("profile-picked"\)[\s\S]*?scene\.remove\(\)/);
  assert.match(app, /function beginProfileGateSelection\(id\)[\s\S]*?releaseProfileGateIntro\(\)/);
  assert.match(app, /handoff:true/);
  assert.match(app, /profile-gate-handoff-avatar/);
  assert.match(app, /profile-gate-handoff-loading/);
  assert.match(app, /profileSecret\(pin\) !== profile\.pinHash[\s\S]*?beginProfileGateSelection\(profile\.id\)/);
  const activation = app.slice(app.indexOf("async function activateProfile("), app.indexOf("function beginProfileGateSelection("));
  assert.ok(activation.indexOf("await loadMyList(); await refreshCatalogForLanguage()") < activation.indexOf("enterHome();"));
  assert.match(styles, /\.profile-gate-selecting \.profile-gate-sheet \{ animation: profile-gate-sheet-lower-away/);
  assert.match(styles, /@keyframes profile-gate-avatar-to-center/);
  assert.match(styles, /top: 46%; left: 50%; width: 86px; height: 86px; animation: profile-gate-avatar-to-center/);
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
  assert.match(app, /profileGate\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\);\s*overlay\.classList\.add\("handoff"\)/);
  assert.match(app, /clearTimeout\(state\.introSafetyTimer\);\s*state\.introSafetyTimer = null;/);
  assert.match(app, /profileGate\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\);\s*overlay\.classList\.add\("handoff"\);\s*const handoffDuration[\s\S]*?return;/);
  const mobileHandoff = app.slice(app.indexOf('if (profileGate?.classList.contains("profile-gate-pending")'), app.indexOf('overlay.classList.add("exiting")'));
  assert.match(mobileHandoff, /const handoffDuration = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \? 80 : 900;\s*state\.introTimer = setTimeout\(dismissIntro, handoffDuration\)/);
  assert.match(app, /function releaseProfileGateIntro\(\)[\s\S]*?scene\.classList\.add\("profile-picked"\)[\s\S]*?scene\.remove\(\)/);
  assert.match(app, /function beginProfileGateSelection\(id\)[\s\S]*?releaseProfileGateIntro\(\)/);
  assert.match(styles, /\.profile-gate-startup-scene \.startup-intro-logo \{ transform: translateY\(-10svh\); transition: transform \.86s cubic-bezier\(\.2,\.75,\.25,1\); \}/);
  assert.match(styles, /\.profile-gate-ready \.profile-gate-sheet \{ animation: profile-gate-desktop-rise/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.profile-gate-sheet \{[\s\S]*?border-radius: 44% 44% 0 0/);
  assert.match(styles, /profile-gate-sheet-rise/);
});

test("the redesigned selector assets are versioned for installed PWAs", () => {
  assert.match(index, /auth\.css\?v=282/);
  assert.match(index, /ui\.css\?v=306/);
  assert.match(index, /app\.js\?v=363/);
  assert.match(serviceWorker, /seven-v364/);
  assert.match(serviceWorker, /auth\.css\?v=282/);
  assert.match(serviceWorker, /ui\.css\?v=306/);
  assert.match(serviceWorker, /app\.js\?v=363/);
  assert.match(serviceWorker, /assets\/profile-person\.svg/);
});
