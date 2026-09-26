const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("the home hero has a fixed desktop label and matched action controls", () => {
  assert.match(app, /hero-eyebrow hero-eyebrow-fixed/);
  assert.match(app, /hero-eyebrow hero-eyebrow-flow/);
  assert.match(app, /class="hero-action-icon"/);
  assert.match(app, /<button type="button" class="hero-info-link"/);
  assert.match(css, /\.hero-eyebrow-fixed \{ position: absolute;/);
  assert.match(css, /\.hero-actions \.hero-play,\.hero-actions \.hero-info-link \{[\s\S]*?min-height: 50px;/);
  assert.match(css, /\.hero-eyebrow-fixed \{ display: none; \}/);
});
