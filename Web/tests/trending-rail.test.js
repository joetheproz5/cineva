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

test("the Trending collection numbers from one instead of using the zero-based grid index", () => {
  assert.match(app, /const ranked = view\.name === "Trending now"[\s\S]*?view\.items\.map\(\(item, index\) => card\(item, ranked \? index \+ 1 : 0\)\)/);
  assert.doesNotMatch(app, /view\.items\.map\(card\)/);
  assert.match(css, /\.explore-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(230px, 1fr\)\)/);
  assert.match(css, /\.card-play \{[\s\S]*?top: 50%;[\s\S]*?left: 50%;/);
  assert.match(css, /\.result-grid \.card-play \{ display: none; \}/);
  assert.match(css, /\.explore-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 20px 14px; \}/);
});
