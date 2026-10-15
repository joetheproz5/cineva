const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("collection controls collapse into the shared Filters button with an active count", () => {
  const start = app.indexOf("function titleBrowserToolbar(");
  const end = app.indexOf("function showTitleBrowserFilters(", start);
  const toolbar = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(toolbar, /class="filter-trigger" data-open-title-browser-filters/);
  assert.match(toolbar, /filter-trigger-count/);
  assert.doesNotMatch(toolbar, /data-title-filter/);
});

test("the collection filter dialog retains all five controls and applies them together", () => {
  const start = app.indexOf("function showTitleBrowserFilters(");
  const end = app.indexOf("function titleBrowserStatus(", start);
  const dialog = app.slice(start, end);
  const bindStart = app.indexOf("function bindTitleBrowser(");
  const bindEnd = app.indexOf("async function openExplore(", bindStart);
  const binding = app.slice(bindStart, bindEnd);
  for (const control of ["type", "genre", "sort", "date", "score"]) assert.ok(dialog.includes(`name="${control}"`));
  assert.match(dialog, /data-clear-title-browser-filters/);
  assert.match(dialog, /openExplore\(view, filters\)/);
  assert.match(dialog, /openAllCatalog\(view\.type, null, 1, false, filters\)/);
  assert.match(binding, /data-open-title-browser-filters.*showTitleBrowserFilters/s);
  assert.match(styles, /\.collection-filter-panel \{[^}]*max-height:[^}]*overflow-y:\s*auto/);
});
