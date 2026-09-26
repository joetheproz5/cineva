const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("the home hero has a fixed desktop label and matched action controls", () => {
  assert.match(app, /<p class="hero-eyebrow">TONIGHT ON SEVEN<\/p>/);
  assert.doesNotMatch(app, /hero-eyebrow-fixed/);
  assert.doesNotMatch(app, /hero-eyebrow-flow/);
  assert.match(app, /class="hero-action-icon"/);
  assert.match(app, /<button type="button" class="hero-info-link"/);
  assert.match(css, /\.hero-actions \.hero-play,\.hero-actions \.hero-info-link \{[\s\S]*?min-height: 50px;/);
});
