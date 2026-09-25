const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("player progress saves in the background without showing seconds or a page bar", () => {
  assert.match(source, /class="progress player-saved-progress"/);
  assert.match(source, /id="time" class="player-saved-time"/);
  assert.match(css, /\.player-saved-progress,\.player-saved-time \{ display: none; \}/);
  assert.match(source, /localStorage\.setItem\(watchKey\(state\.player\)/);
  assert.match(source, /queueProgressSync\(state\.player, currentTime, duration, progress\)/);
});
