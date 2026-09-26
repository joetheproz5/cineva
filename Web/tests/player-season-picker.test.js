const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("the player uses a clean season rail instead of a native select", () => {
  assert.match(app, /class="season-rail"/);
  assert.match(app, /data-player-season/);
  assert.doesNotMatch(app, /id="player-season-selector"/);
  assert.match(css, /\.season-rail button\[aria-current="true"\]/);
  assert.doesNotMatch(css, /\.season-picker-menu/);
});
