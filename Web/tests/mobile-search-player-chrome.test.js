const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("mobile search cards share one poster frame and keep ratings clear", () => {
  assert.match(app, /function mobileSearchCard\(item\)/);
  assert.match(app, /items\.map\(mobileSearchCard\)/);
  assert.match(css, /\.msearch-card,\.msearch-skeleton\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(css, /\.msearch-poster,\.msearch-skeleton\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3;/);
  assert.match(css, /\.msearch-poster img\s*\{[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover;/);
  assert.match(css, /\.msearch-poster em\s*\{[\s\S]*?border-radius:\s*999px;/);
});

test("the player header presents episode context instead of a cinema brand", () => {
  const start = app.indexOf("function renderPlayer()");
  const end = app.indexOf("function bindPlayer", start);
  const player = app.slice(start, end);

  assert.match(player, /player-stage-context/);
  assert.match(player, /player-stage-actions/);
  assert.match(player, /party-quick/);
  assert.doesNotMatch(player, /SEVEN CINEMA/);
  assert.doesNotMatch(player, /party-start/);
  assert.match(css, /\.player-stage-context\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.player-stage-actions \.provider-menu\s*\{\s*grid-column:\s*2;\s*grid-row:\s*1;/);
  assert.match(css, /\.party-quick\s*\{[\s\S]*?border-radius:\s*50%;/);
});

test("the mobile navigation does not reserve an extra bottom row", () => {
  assert.match(css, /header\.main-header\.app-header > nav\s*\{\s*height:\s*66px;\s*min-height:\s*66px;\s*padding:\s*6px 8px;/);
  assert.match(css, /\.player-episodes \.episode\s*\{\s*min-height:\s*0;/);
  assert.match(css, /\.player-episodes \.episode-main\s*\{\s*min-height:\s*65px;/);
});
