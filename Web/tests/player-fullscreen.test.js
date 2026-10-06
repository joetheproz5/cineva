const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const androidActivity = fs.readFileSync(path.resolve(__dirname, "..", "..", "Android", "app", "src", "main", "java", "com", "example", "cineva", "MainActivity.kt"), "utf8");
test("the server's own fullscreen control is the only fullscreen control", () => {
  assert.doesNotMatch(source, /data-player-fullscreen/);
  assert.doesNotMatch(source, /function togglePlayerFullscreen/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, "..", "ui.css"), "utf8"), /\.player-fullscreen/);
});

test("the server iframe has mobile-compatible fullscreen permission", () => {
  assert.match(source, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
  assert.match(source, /allowfullscreen webkitallowfullscreen mozallowfullscreen/);
});

test("the player iframe is not sandboxed so streaming providers can load", () => {
  const iframe = source.match(/const media = `(<iframe[^`]+)`;/)?.[1] || "";
  assert.match(iframe, /<iframe\b/);
  assert.doesNotMatch(iframe, /\bsandbox(?:\s|=|>)/);
  assert.match(source, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
});

test("the PWA requests landscape only while fullscreen and releases its orientation lock on exit", () => {
  assert.match(source, /document\.addEventListener\("fullscreenchange", syncFullscreenOrientation\)/);
  assert.match(source, /orientation\.lock\("landscape"\)/);
  assert.match(source, /if \(!fullscreenElement\) \{[\s\S]*?orientation\.unlock\?\.\(\)/);
});

test("Android video fullscreen requests landscape and restores the prior orientation", () => {
  assert.match(androidActivity, /fullscreenPreviousOrientation = requestedOrientation[\s\S]*?requestedOrientation = ActivityInfo\.SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(androidActivity, /fullscreenPreviousOrientation\?\.let \{ requestedOrientation = it \}[\s\S]*?fullscreenPreviousOrientation = null/);
});
