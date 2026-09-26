const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("movie actions use the same full-width mobile action pattern as series", () => {
  assert.match(app, /class="movie-detail-copy"/);
  assert.match(app, /class="actions movie-actions"/);
  assert.match(app, /querySelector\("\.movie-detail-copy"\)/);
  assert.match(css, /\.movie-actions \{ grid-column: 1 \/ -1; display: grid !important; grid-template-columns: repeat\(3,minmax\(0,1fr\)\) !important;/);
  assert.match(css, /\.movie-actions \.primary \{ grid-column: 1 \/ -1; \}/);
});
