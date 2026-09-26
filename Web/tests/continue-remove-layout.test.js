const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "ui.css"), "utf8");

test("desktop continue controls share the card width with their remove button", () => {
  assert.match(css, /@media \(min-width: 651px\) \{\s*\.home-library \.continue-item \{ width: 100%; \}\s*\.home-library \.continue-item \.continue-card \{ width: 100%; max-width: 100%; \}/);
  assert.match(css, /\.continue-remove \{[\s\S]*?top: 7px;[\s\S]*?right: 7px;[\s\S]*?place-items: center;/);
});
