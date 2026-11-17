const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("Home rows render through the shared rail, card and skeleton kit", () => {
  assert.match(app, /function rail\(name, items\)[\s\S]*?posterRail\(name, visible, key, \{ home:true/);
  assert.match(app, /function newEpisodeRail\(items\)[\s\S]*?posterRail\("New episodes"/);
  assert.match(app, /function homeSkeleton\(\)[\s\S]*?collectionSkeletonRail\(\{ home:true \}\)/);
  assert.match(app, /CARDS_PER_VIEW = \[\{ min:0, count:3 \}, \{ min:600, count:4 \}, \{ min:900, count:5 \}, \{ min:1200, count:6 \}, \{ min:1600, count:7 \}\]/);
  assert.match(app, /function rail\(name, items\)[\s\S]*?posterRail\(name, visible, key, \{ home:true \}\)/);
  assert.match(css, /\.home-library \.home-poster-rail \.collection-rail-heading/);
});

test("Home cards keep their details and watchlist actions while posters stay lazy and responsive", () => {
  assert.match(app, /function posterCard\(item, variant = "watchlist", options = \{\}\)/);
  assert.match(app, /const imageWidths = options\.home \? \[185,342,500\]/);
  assert.match(app, /loading="lazy" decoding="async"/);
  assert.match(app, /const openAttributes = options\.continueKey \? `data-continue=/);
  assert.match(app, /else action = watchlistAction\(item, "card"\)/);
  assert.match(app, /collection-poster-fallback/);
  assert.match(css, /\.home-library \.home-poster-card \.collection-poster-frame \{ border:0; box-shadow:none; \}/);
  assert.match(css, /\.home-library \.home-poster-card \.collection-poster-open:focus-visible/);
  assert.match(css, /\.home-library \.home-poster-track \{ grid-auto-columns:var\(--collection-card-width/);
});

test("Continue watching keeps resume, remove, progress, series caption and accessible metadata", () => {
  assert.match(app, /function continueRail\(items\)[\s\S]*?continueKey:identity/);
  assert.match(app, /accessibleExtra:\[episode, resume\]\.filter\(Boolean\)/);
  assert.match(app, /overlayMeta:\[episode, resume\]\.filter\(Boolean\)\.join\(" · "\)/);
  assert.match(app, /progress:playbackProgressPercent\(item\)/);
  assert.match(app, /data-remove-continue=/);
  assert.match(css, /\.home-library \.home-poster-progress > span \{[\s\S]*?min-width:6px/);
  assert.match(css, /\.home-library \.home-continue-caption \{[\s\S]*?font-size:13px/);
});

test("the Home banner preserves its trailer destination and uses responsive scoped styles", () => {
  assert.match(app, /class="play-something-banner" aria-labelledby=/);
  assert.match(app, /class="primary" data-trailers>\$\{t\("Play something"\)\}/);
  assert.match(app, /class="play-something-new-picks" data-trailers>New picks/);
  assert.match(app, /document\.querySelectorAll\("\[data-trailers\]"\)\.forEach\(button => button\.onclick = openTrailers\)/);
  assert.match(css, /\.home-library \.play-something-banner \{[\s\S]*?margin:56px 0 40px/);
  assert.match(css, /\.home-library \.play-something-copy p \{[\s\S]*?font-size:14px/);
  assert.match(css, /@media \(max-width:650px\) \{[\s\S]*?\.home-library \.play-something-actions \.primary \{ width:100%; \}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});

test("phone banner uses compact spacing and naturally wraps actions without changing wider layouts", () => {
  const phoneBanner = css.match(/@media \(max-width:767px\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(phoneBanner, /margin:40px 0 32px/);
  assert.match(phoneBanner, /gap:20px/);
  assert.match(phoneBanner, /-webkit-line-clamp:2/);
  assert.match(phoneBanner, /flex-flow:row wrap/);
  assert.match(phoneBanner, /flex:1\.6 1 max-content/);
  assert.match(phoneBanner, /flex:1 1 max-content/);
  assert.match(phoneBanner, /height:48px/);
  assert.match(phoneBanner, /background:color-mix\(in srgb,var\(--text\) 10%,transparent\)/);
  assert.match(phoneBanner, /white-space:nowrap/);
  assert.match(phoneBanner, /button:active \{ opacity:\.88; transform:scale\(\.98\); \}/);
  assert.doesNotMatch(css, /@media \(min-width:768px\)[\s\S]*?play-something-banner/);
});
