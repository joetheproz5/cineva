const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const promptMinimum = source.match(/const NEXT_EPISODE_PROMPT_MIN_SECONDS[^\r\n]*/)?.[0];
const promptMaximum = source.match(/const NEXT_EPISODE_PROMPT_MAX_SECONDS[^\r\n]*/)?.[0];
const promptLeadFunction = source.match(/function nextEpisodePromptLeadSeconds[^\r\n]*/)?.[0];
const promptReadyFunction = source.match(/function nextEpisodePromptReady[^\r\n]*/)?.[0];

function isPromptReady(currentTime, duration) {
  if (!promptMinimum || !promptMaximum || !promptLeadFunction || !promptReadyFunction) throw new Error("Next-episode prompt logic was not found.");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${promptMinimum}\n${promptMaximum}\n${promptLeadFunction}\n${promptReadyFunction}`, context);
  return context.nextEpisodePromptReady(currentTime, duration);
}

test("next-episode prompt uses a duration-aware 45–90 second window", () => {
  assert.equal(isPromptReady(2518, 2597), false);
  assert.equal(isPromptReady(2519, 2597), true);
  assert.equal(isPromptReady(2597, 2597), false);
  assert.equal(isPromptReady(1154, 1200), false);
  assert.equal(isPromptReady(1155, 1200), true);
  assert.equal(isPromptReady(2910, 3000), true);
});
