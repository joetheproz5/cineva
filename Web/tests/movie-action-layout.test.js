const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("movie and series detail pages keep the main action row compact", () => {
  assert.match(app, /class="actions movie-actions title-actions"/);
  assert.match(app, /class="actions title-actions"/);
  assert.match(app, /function titleMoreAction\(item, extraActions = ""\)/);
  assert.match(app, /data-title-more aria-haspopup="true"/);
  assert.match(app, /data-toggle-my-list/);
  assert.match(app, /data-trailer/);
  assert.match(app, /data-share-title/);
  assert.match(app, /ratingAction\(item\)/);
  assert.match(app, /closeTitleMenus\(true\)/);
  assert.match(css, /\.title-actions \{ position: relative; z-index: 12; display: flex !important;/);
  assert.match(css, /\.title-more-menu\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.movie-actions\.title-actions \.primary/);
  assert.match(css, /\.series-hero-copy \.actions\.title-actions/);
});
