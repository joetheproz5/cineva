const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "..", "ui.css"), "utf8");

test("the trending rail preserves TMDB order and presents exactly four ranked titles", () => {
  assert.match(app, /api\("trending\/all\/week"\)/);
  assert.match(app, /trending = results\(trendingData\)/);
  assert.match(app, /railItems = ranked \? visible\.slice\(0, 4\) : visible/);
  assert.match(app, /ranked-card rank-\$\{rank\}/);
  assert.match(app, /<span class="card-rank-core"><b>\$\{String\(rank\)\.padStart\(2, "0"\)\}<\/b><\/span>/);
  assert.match(css, /\.ranked-card\.rank-2 \{ --rank-a: #27d7ff; --rank-b: #7067ff; \}/);
  assert.match(css, /font-size: 72px; font-style: italic; font-weight: 950;/);
});
