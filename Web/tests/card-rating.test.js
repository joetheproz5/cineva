const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "ui.css"), "utf8");

test("rating badges are positioned on every poster card", () => {
  assert.match(css, /\.card-score\s*\{\s*position:\s*absolute;[\s\S]*?right:\s*9px;[\s\S]*?bottom:\s*9px;/);
});
