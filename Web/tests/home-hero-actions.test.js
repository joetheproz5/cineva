const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("hero title and action controls keep their current markup and matched styles", () => {
  assert.match(app, /<div class="home-hero-content[\s\S]*?<h1>\$\{escapeHTML\(titleOf\(f\)\)\}<\/h1>/);
  assert.match(app, /<div class="hero-actions"><button class="hero-play"[\s\S]*?<button type="button" class="hero-info-link"/);
  assert.match(css, /\.hero-actions \.hero-play,\.hero-actions \.hero-info-link \{[\s\S]*?min-height: 50px;/);
});
