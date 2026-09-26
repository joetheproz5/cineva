const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("title sharing is an action button and uses the PWA-scoped URL", () => {
  assert.match(app, /class="secondary share-action" data-share-title/);
  assert.match(app, /new URL\("\.\/", window\.location\.href\)/);
  assert.match(app, /\$\{trailerAction\(\)\}\$\{shareAction\(\)\}/);
  assert.match(styles, /\.share-action \{ display: inline-flex;/);
});
