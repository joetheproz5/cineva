const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
test("the server's own fullscreen control is the only fullscreen control", () => {
  assert.doesNotMatch(source, /data-player-fullscreen/);
  assert.doesNotMatch(source, /function togglePlayerFullscreen/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, "..", "ui.css"), "utf8"), /\.player-fullscreen/);
});

test("the server iframe has mobile-compatible fullscreen permission", () => {
  assert.match(source, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
  assert.match(source, /allowfullscreen webkitallowfullscreen mozallowfullscreen/);
});

test("the player iframe blocks popups and top-level redirects without disabling playback", () => {
  assert.match(source, /sandbox="\$\{PLAYER_IFRAME_SANDBOX\}"/);
  assert.match(source, /const PLAYER_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock allow-pointer-lock"/);
  assert.doesNotMatch(source.match(/const PLAYER_IFRAME_SANDBOX = "([^"]+)"/)?.[1] || "", /allow-popups|allow-top-navigation|allow-downloads/);
  assert.match(source, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
});
