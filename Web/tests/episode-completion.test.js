const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const completionLogic = source.match(/const PREVIOUS_EPISODE_WATCHED_PERCENT[^\r\n]*\r?\nconst NEXT_EPISODE_CONFIRMATION_PERCENT[^\r\n]*\r?\nfunction selectedPlayerProvider[^\r\n]*\r?\nfunction playbackProgressPercent[^\r\n]*\r?\nfunction isDirectNextEpisode[^\r\n]*\r?\nfunction shouldConfirmPreviousEpisode[^\r\n]*/)?.[0];

function shouldComplete(previous, current, previousRecord, currentProgress) {
  if (!completionLogic) throw new Error("Episode completion logic was not found.");
  const context = {};
  vm.createContext(context);
  vm.runInContext(completionLogic, context);
  return context.shouldConfirmPreviousEpisode(previous, current, previousRecord, currentProgress);
}

const episodeSeven = { type:"tv", id:71712, season:4, episode:7 };
const episodeEight = { type:"tv", id:71712, season:4, episode:8 };

test("confirms a half-watched episode after a quarter of its direct successor", () => {
  assert.equal(shouldComplete(episodeSeven, episodeEight, { currentTime:1300, duration:2500 }, 24.9), false);
  assert.equal(shouldComplete(episodeSeven, episodeEight, { currentTime:1300, duration:2500 }, 25), true);
});

test("does not complete an episode after a short watch or a non-successor", () => {
  assert.equal(shouldComplete(episodeSeven, episodeEight, { currentTime:1249, duration:2500 }, 60), false);
  assert.equal(shouldComplete(episodeSeven, { ...episodeEight, episode:9 }, { currentTime:1300, duration:2500 }, 60), false);
});
