const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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

test("the launch intro finishes its reveal and waits for startup before fading", () => {
  const start = app.indexOf("function dismissIntro()");
  const end = app.indexOf("function screenTimeState(", start);
  const intro = app.slice(start, end);

  assert.doesNotMatch(intro, /addEventListener\("click", dismissIntro/);
  assert.match(intro, /logo\.decode\(\)/);
  assert.match(intro, /event\.animationName === "intro-atmosphere"/);
  assert.match(intro, /!state\.startupReady \|\| !state\.introAnimationComplete/);
  assert.match(intro, /state\.introSafetyTimer = setTimeout\(/);
  assert.match(app, /void boot\(\)\.then\(markStartupReady/);
  assert.match(styles, /\.seven-intro\.exiting/);
  assert.match(styles, /animation-play-state: paused/);
  assert.match(index, /ui\.css\?v=260/);
  assert.match(index, /app\.js\?v=252/);
  assert.match(serviceWorker, /seven-v263/);
  assert.match(serviceWorker, /ui\.css\?v=260/);
  assert.match(serviceWorker, /app\.js\?v=252/);
});
