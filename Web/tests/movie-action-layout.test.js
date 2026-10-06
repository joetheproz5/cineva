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
  assert.match(app, /data-play-movie><svg class="title-menu-icon"[\s\S]*?<span>Start over<\/span>/);
  assert.match(app, /data-play-movie><svg class="title-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5M5\.2 12a7 7 0 1 0 2-4\.95L4 12"\/><\/svg><span>Start over<\/span>/);
  assert.match(app, /data-toggle-my-list><svg class="title-menu-icon"[\s\S]*?<span>\$\{isInMyList\(item\)/);
  assert.match(app, /function keepFavouritesUI\(\)[\s\S]*?button\.querySelector\("span"\)[\s\S]*?button\.textContent/);
  assert.match(app, /closeTitleMenus\(true\)/);
  assert.match(css, /\.title-actions \{ position: relative; z-index: 12; display: flex !important;/);
  assert.match(css, /\.title-more-menu\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.title-more-menu::after/);
  assert.match(css, /\.title-menu-icon \{ display: block; width: 18px; height: 18px; flex: 0 0 20px;/);
  assert.match(css, /\.title-more-menu-actions > button \{ display: flex; width: 100%; min-height: 42px;/);
  assert.match(css, /\.detail \.actions\.title-actions \.title-more-menu-actions > button,\.series-hero-copy \.actions\.title-actions \.title-more-menu-actions > button \{ display: flex !important;[\s\S]*?background: transparent !important;/);
  assert.match(css, /\.detail \.actions\.title-actions \.title-more \.rate-btn,\.series-hero-copy \.actions\.title-actions \.title-more \.rate-btn \{ display: grid !important; width: 36px !important; min-width: 36px !important;[\s\S]*?border-radius: 50% !important;/);
  assert.match(css, /\.ranked-card \.poster-wrap > i \{ right: auto; left: 10px; \}/);
  assert.match(css, /\.movie-actions\.title-actions \.primary/);
  assert.match(css, /\.series-hero-copy \.actions\.title-actions/);
});
