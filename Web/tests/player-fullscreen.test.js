const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("async function togglePlayerFullscreen");
const end = source.indexOf("function renderPlayer", start);

function fullscreenHarness({ fullscreenElement = null, requestFullscreen, exitFullscreen } = {}) {
  const frame = { requestFullscreen, webkitRequestFullscreen:null };
  const document = {
    fullscreenElement,
    webkitFullscreenElement:null,
    exitFullscreen,
    webkitExitFullscreen:null,
    querySelector:selector => selector === ".player-frame" ? frame : null
  };
  const context = { document, showToast:message => { context.toast = message; } };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, frame };
}

test("the native fullscreen button is rendered for every embedded provider", () => {
  assert.match(source, /data-player-fullscreen/);
  assert.match(source, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
});

test("the fullscreen control expands the local player frame", async () => {
  let requested = false;
  const { context, frame } = fullscreenHarness({ requestFullscreen() { requested = this === frame; } });
  await context.togglePlayerFullscreen();
  assert.equal(requested, true);
});

test("the fullscreen control exits when the player is already fullscreen", async () => {
  let exited = false;
  const { context } = fullscreenHarness({ exitFullscreen() { exited = this !== null; } });
  // The harness creates its own frame, so point the document at that frame before calling.
  context.document.fullscreenElement = context.document.querySelector(".player-frame");
  await context.togglePlayerFullscreen();
  assert.equal(exited, true);
});
