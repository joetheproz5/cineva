const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

test("SEVEN leaves next-episode controls to the embedded providers", () => {
  assert.doesNotMatch(source, /nextEpisodePromptReady|data-next-player-action|player-frame-next|player-next/);
  assert.match(source, /autoNext=true&nextButton=true/);
  assert.match(source, /autonext:"true"/);
  assert.match(source, /isTrustedPlayerEpisodeChange/);
});
