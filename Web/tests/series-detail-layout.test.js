const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("series details keep progress, season, episode, and title actions on the shared page", () => {
  assert.match(app, /const continueRow = hasProgress && next/);
  assert.match(app, /data-play-up-next/);
  assert.match(app, /function bindSeriesTitlePage\(series\)/);
  assert.match(app, /data-toggle-episode/);
  assert.match(app, /function openSeasonMenu\(trigger, seasons\)/);
  assert.match(app, /seasons\.length > 6/);
  assert.match(app, /class="collection-tabs title-season-tabs"/);
  assert.match(app, /class="title-episode-row/);
  assert.match(app, /aria-label="\$\{watched \? "Mark unwatched" : "Mark watched"\}"/);
  assert.match(app, /titleResponsiveImage\(episode\.still_path/);
  assert.match(app, /function titleDetailsSection\(item, type\)/);
  assert.match(app, /\[\["Created by"/);
  assert.match(css, /\.title-episode-row \{ display:flex; min-height:112px/);
  assert.match(css, /\.title-episode-main \{ display:grid; flex:1; min-width:0; grid-template-columns:160px/);
  assert.match(css, /\.title-episode-toggle \{ display:grid; width:44px/);
  assert.match(css, /\.title-season-tabs/);
  assert.match(css, /\.title-continue-row/);
  assert.match(css, /@media \(max-width:650px\)[\s\S]*?\.title-episode-row \{ min-height:96px/);
});
