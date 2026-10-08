const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "ui.css"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");

test("opening a movie or series does not scroll Home before its details load", () => {
  const start = app.indexOf("async function openItem(type, id)");
  const end = app.indexOf("async function loadEpisodes()", start);
  const openItem = app.slice(start, end);

  assert.ok(start >= 0 && end > start, "openItem function should exist");
  assert.doesNotMatch(openItem, /scrollToTop\(\);\s*try/);
  assert.match(openItem, /render\(\);\s*scrollToTop\(\);/);
});

test("the launch intro is static on entry, starts once, and fades out once after readiness", () => {
  const start = app.indexOf("function dismissIntro()");
  const end = app.indexOf("function screenTimeState(", start);
  const intro = app.slice(start, end);

  assert.doesNotMatch(intro, /addEventListener\("click", dismissIntro/);
  assert.match(intro, /logo\.decode\(\)/);
  assert.match(intro, /if \(state\.introStarted\) return;\s*state\.introStarted = true;/);
  assert.match(intro, /imageReady\.then\(startIntro\)/);
  assert.match(intro, /if \(state\.introDismissed\) return;\s*state\.introDismissed = true;/);
  assert.match(intro, /!state\.startupReady \|\| !state\.introAnimationComplete/);
  assert.match(intro, /state\.introSafetyTimer = setTimeout\(/);
  assert.match(intro, /document\.documentElement\.classList\.add\("seven-launching"\)/);
  assert.match(intro, /document\.documentElement\.classList\.remove\("seven-launching"\)/);
  const finishIntroStart = app.indexOf("function maybeFinishIntro()");
  const finishIntroEnd = app.indexOf("function StartupIntro()", finishIntroStart);
  const finishIntro = app.slice(finishIntroStart, finishIntroEnd);
  assert.match(finishIntro, /profileGate\?\.classList\.contains\("profile-gate-pending"\)[\s\S]*?profileGate\.classList\.replace\("profile-gate-pending", "profile-gate-ready"\)/);
  assert.match(finishIntro, /overlay\.classList\.add\("exiting"\)/);
  assert.doesNotMatch(finishIntro, /profile-gate-intro-active|\.classList\.add\("handoff"\)/);
  assert.match(app, /void boot\(\)\.then\(markStartupReady/);
  assert.doesNotMatch(intro, /handoffDuration|setTimeout\(dismissIntro, handoffDuration\)/);
  assert.match(styles, /\.seven-intro\.exiting/);
  assert.match(styles, /\.seven-intro\.exiting \{ animation: intro-out \.44s ease forwards; pointer-events: none; \}/);
  const introStyles = styles.slice(styles.indexOf(".seven-intro {"), styles.indexOf(".offline-screen"));
  assert.match(styles, /html\.seven-launching,html\.seven-launching body \{ background: var\(--seven-startup-background\); \}/);
  assert.match(styles, /html\.seven-launching #app \{ visibility: hidden; \}/);
  assert.match(introStyles, /\.seven-intro \{[^}]*position: fixed; z-index: 400; inset: 0;/);
  assert.doesNotMatch(introStyles, /\.seven-intro \{[^}]*bottom: -96px/);
  assert.match(introStyles, /\.startup-intro-scene \{[^}]*position: absolute; z-index: 1; inset: 0;/);
  assert.match(introStyles, /@keyframes intro-out \{ to \{ opacity: 0; visibility: hidden; \} \}/);
  assert.doesNotMatch(introStyles, /@keyframes intro-out \{[^}]*transform:/);
  assert.match(introStyles, /\.startup-intro-mark \{[^}]*opacity: 1; filter: none/);
  assert.doesNotMatch(introStyles, /\.startup-intro-mark \{[^}]*transform:/);
  assert.doesNotMatch(introStyles, /animation:\s*(?:intro-stage|intro-atmosphere|intro-rays|intro-bloom|intro-flare)|@keyframes intro-(?:stage-light|atmosphere|rays|bloom|flare)/);
  assert.doesNotMatch(introStyles, /intro-mark-focus|intro-sweep|startup-intro-sweep/);
  assert.doesNotMatch(styles, /\.startup-intro-mark \{[^}]*animation:/);
  assert.equal((index.match(/class="seven-intro"/g) || []).length, 1);
  assert.equal((index.match(/class="startup-intro-mark"/g) || []).length, 1);
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(index, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.doesNotMatch(index + app, /startup-intro-sweep/);
  assert.doesNotMatch(styles, /\.seven-intro\.reduced-motion|\.seven-intro\.live,\.startup-intro-rays/);
  assert.doesNotMatch(styles, /\.seven-intro:not\(\.live\)[^}]*animation-play-state:\s*paused/);
  assert.match(index, /ui\.css\?v=317/);
  assert.match(index, /startup-theme\.css\?v=2/);
  assert.match(index, /auth\.css\?v=284/);
  const appVersion = index.match(/app\.js\?v=(\d+)/)?.[1];
  const workerShellAppVersion = serviceWorker.match(/"app\.js\?v=(\d+)"/)?.[1];
  const workerCacheVersion = serviceWorker.match(/seven-v(\d+)/)?.[1];
  const workerRegistrationVersion = app.match(/register\("service-worker\.js\?v=(\d+)"/)?.[1];
  assert.ok(appVersion);
  assert.equal(workerShellAppVersion, appVersion);
  assert.equal(workerCacheVersion, "375");
  assert.equal(workerRegistrationVersion, workerCacheVersion);
  assert.match(serviceWorker, /auth\.css\?v=284/);
  assert.match(serviceWorker, /ui\.css\?v=317/);
  assert.match(serviceWorker, /startup-theme\.css\?v=2/);
  assert.match(serviceWorker, /assets\/seven-wordmark-v2\.png/);
  assert.doesNotMatch(serviceWorker, /controllerchange|location\.reload\(|clients\.navigate\(/);
});

test("the footer back-to-top link animates even when reduced motion is requested", () => {
  assert.match(app, /<a class="footer-top" href="#app"/);
  assert.match(app, /document\.addEventListener\("click", event => \{\s*const topLink = event\.target\?\.closest\?\.\("\.footer-top"\);\s*if \(!topLink\) return;\s*event\.preventDefault\(\);\s*animateScrollToTop\(\);\s*\}, true\)/);

  const start = app.indexOf("function animateScrollToTop()");
  const end = app.indexOf("async function localAPI", start);
  const helper = app.slice(start, end);
  assert.ok(start >= 0 && end > start, "animated scroll helper should exist");
  assert.match(helper, /requestAnimationFrame\(step\)/);
  assert.doesNotMatch(helper, /prefersReducedMotion/);

  const root = { scrollTop:900 };
  const body = { scrollTop:900 };
  const frames = [];
  const context = {
    state:{ footerScrollFrame:0 },
    window:{ scrollY:900, scrollTo(_x, y) { root.scrollTop = y; } },
    document:{ scrollingElement:root, documentElement:root, body },
    prefersReducedMotion:() => true,
    cancelAnimationFrame() {},
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; }
  };
  vm.runInNewContext(`${helper}\nanimateScrollToTop();`, context);
  frames.shift()(0);
  frames.shift()(100);
  assert.ok(root.scrollTop > 0 && root.scrollTop < 900, "scroll should visibly advance before reaching the top");
  while (frames.length) frames.shift()(500);
  assert.equal(root.scrollTop, 0);
  assert.equal(body.scrollTop, 0);
});

test("the home spotlight shares the header and rail content column", () => {
  assert.match(app, /class="home-hero-layout"/);
  assert.match(styles, /\.home-hero-layout \{[\s\S]*?width: min\(1480px,100%\);[\s\S]*?padding: 0 clamp\(18px,3vw,44px\) clamp\(145px,18vh,190px\);/);
  assert.match(styles, /\.home-hero-content \{ position: relative; width: min\(700px,47%\);/);
  assert.doesNotMatch(styles, /\.home-hero-content \{[^}]*left: clamp\(30px, 11vw, 205px\)/);
});
