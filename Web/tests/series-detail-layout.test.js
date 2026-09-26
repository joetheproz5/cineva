const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("series details use an aligned episode guide and softened backdrop fade", () => {
  assert.match(app, /series-hero-fade/);
  assert.match(app, /class="series-season-rail"/);
  assert.match(app, /data-series-season/);
  assert.doesNotMatch(app, /id="season-selector"/);
  assert.match(css, /\.series-hero-fade/);
  assert.match(css, /filter: blur\(22px\)/);
  assert.match(css, /\.series-shell \{ width: min\(1400px,calc\(100% - 56px\)\);/);
  assert.match(css, /\.series-episodes \{ width: 100%; max-width: none;/);
  assert.match(css, /\.series-episode-grid \{ display: grid; grid-template-columns: 1fr;/);
  assert.match(css, /\.series-episode \.episode-main \{ display: grid; grid-template-columns: 180px minmax\(0,1fr\)/);
});
