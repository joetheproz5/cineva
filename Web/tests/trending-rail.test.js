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
  assert.match(app, /class="card-rank" aria-label="Rank \$\{rank\}"\>\$\{String\(rank\)\.padStart\(2, "0"\)\}/);
  assert.match(app, /class="card-copy \$\{rank \? "ranked-copy" : ""\}"/);
  assert.match(css, /\.ranked-copy \.card-rank \{[\s\S]*?color: #e50914;[\s\S]*?font-size: 42px;/);
});
