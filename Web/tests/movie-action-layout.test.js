const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("movie and series detail pages share the scoped title-page hero and action kit", () => {
  assert.match(app, /function titleHero\(item, type, primary/);
  assert.match(app, /function titlePageMoreAction\(item, extraActions = ""\)/);
  assert.match(app, /let titleMenuSequence = 0;/);
  assert.match(app, /aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(app, /data-toggle-my-list/);
  assert.match(app, /data-trailer/);
  assert.match(app, /data-share-title/);
  assert.match(app, /function renderMovie\(\)[\s\S]*?titleMoreLikeThis\(movie, "movie"\)/);
  assert.match(app, /function renderSeries\(\)[\s\S]*?titleMoreLikeThis\(s, "tv"\)/);
  assert.match(app, /titlePageSharedBindings\("movie", movie\)/);
  assert.match(app, /titlePageSharedBindings\("tv", s\)/);
  assert.match(app, /function closeTitleMenus\(restoreFocus = false\)/);
  assert.match(app, /function openTitleMenu\(trigger\)/);
  assert.match(css, /\.title-detail-page \{/);
  assert.match(css, /\.title-page-actions > \.watchlist-action/);
  assert.match(css, /\.title-page-more-menu\[hidden\]/);
  assert.match(css, /\.title-portal-layer button:focus-visible/);
  assert.match(css, /@media \(max-width:650px\)[\s\S]*?\.title-page-more-menu\[data-presentation="sheet"\]/);
});

test("title-page related posters use existing catalog data and lazy w185/w342 images", () => {
  assert.match(app, /function titleRelatedItems\(item, type\)/);
  assert.match(app, /Object\.values\(state\.catalog \|\| \{\}\)/);
  assert.match(app, /function titleResponsiveImage\(path/);
  assert.match(app, /loading="lazy" decoding="async"/);
  assert.match(app, /\[185, 342\]/);
  assert.match(app, /data-title-show-more/);
});

test("opening a title renders before optional trailer and episode requests finish", () => {
  const openItem = app.match(/async function openItem\(type, id, trigger = null\) \{[\s\S]*?(?=\nfunction titleOpenRequestIsCurrent\()/)?.[0];
  assert.ok(openItem, "openItem is present");
  assert.doesNotMatch(openItem, /await\s+(?:loadTrailer|loadEpisodes|loadSeriesNext)\(/);
  assert.match(app, /function titleOpenPreview\(type, id, trigger\)/);
  assert.match(app, /function renderTitleLoading\(item, type\)/);
  assert.match(openItem, /state\.movie = preview; state\.series = null; state\.route = "movie"/);
  assert.match(openItem, /state\.series = preview; state\.movie = null;[\s\S]*?state\.route = "series";\s*\}\s*render\(\); scrollToTop\(\);/);
  assert.match(openItem, /loadSeriesTitleExtras\(item\.id/);
  assert.match(app, /function loadSeriesTitleExtras\(/);
  assert.match(app, /function loadTitleTrailerInBackground\(/);
  assert.match(app, /openItem\(type, id, button\)/);
});
