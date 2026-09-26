const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("the player uses a custom season picker instead of a native select", () => {
  assert.match(app, /data-season-picker-trigger/);
  assert.match(app, /data-player-season/);
  assert.doesNotMatch(app, /id="player-season-selector"/);
  assert.match(css, /\.season-picker-menu/);
  assert.match(css, /\.season-picker-menu button\[aria-selected="true"\]/);
});
