const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const introSkip = require("../intro-skip.js");
const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.resolve(__dirname, "..", "service-worker.js"), "utf8");

test("builds TheIntroDB episode lookups from validated TMDB episode identifiers", () => {
  const media = { type:"tv", id:1396, season:1, episode:1 };
  assert.equal(introSkip.mediaKey(media), "1396:1:1");
  assert.equal(introSkip.requestURL(media), "https://api.theintrodb.org/v3/media?tmdb_id=1396&season=1&episode=1");
  assert.equal(introSkip.requestURL({ ...media, type:"movie" }), null);
  assert.equal(introSkip.requestURL({ ...media, episode:0 }), null);
});

test("normalizes valid intro segments and safely rejects missing or malformed data", () => {
  assert.deepEqual(introSkip.normalizeIntro({ intro:[{ start_ms:228664, end_ms:246143 }] }), { startMs:228664, endMs:246143 });
  assert.deepEqual(introSkip.normalizeIntro({ intro:[{ start_ms:null, end_ms:90000 }] }), { startMs:0, endMs:90000 });
  assert.equal(introSkip.normalizeIntro({}), null);
  assert.equal(introSkip.normalizeIntro({ intro:[{ start_ms:30000, end_ms:20000 }] }), null);
  assert.equal(introSkip.normalizeIntro({ intro:[{ start_ms:0, end_ms:1000 }] }), null);
});

test("shows skip only through the intro window and seeks to the first second after it", () => {
  const intro = { startMs:228664, endMs:246143 };
  assert.equal(introSkip.shouldShow(intro, 225.7, 2400), true);
  assert.equal(introSkip.shouldShow(intro, 220, 2400), false);
  assert.equal(introSkip.shouldShow(intro, 246.143, 2400), false);
  assert.equal(introSkip.shouldShow(intro, 230, 240), false);
  assert.equal(introSkip.seekTarget(intro), 247);
  assert.equal(introSkip.seekTarget(null), null);
});

test("the app gates timestamp lookups and seek commands to CineSrc and never blocks playback", () => {
  assert.match(app, /selectedPlayerProvider\(\) !== "cinesrc" \|\| party\.code/);
  assert.match(app, /sendPlayerCommand\("cinesrc", "seek", \[target\]\)/);
  assert.match(app, /catch \{\s*\/\/ This is an optional convenience; a database\/network failure never blocks playback\./);
  assert.match(app, /data-skip-intro/);
  assert.ok(index.indexOf("intro-skip.js?v=1") < index.indexOf("app.js?v=313"));
  assert.match(serviceWorker, /"intro-skip\.js\?v=1"/);
  assert.match(serviceWorker, /"\/intro-skip\.js"/);
});
