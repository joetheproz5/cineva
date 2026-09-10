const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const promptSeconds = source.match(/const NEXT_EPISODE_PROMPT_SECONDS[^\r\n]*/)?.[0];
const promptFunction = source.match(/function nextEpisodePromptReady[^\r\n]*/)?.[0];

function isPromptReady(currentTime, duration) {
  if (!promptSeconds || !promptFunction) throw new Error("Next-episode prompt logic was not found.");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${promptSeconds}\n${promptFunction}`, context);
  return context.nextEpisodePromptReady(currentTime, duration);
}

test("next-episode prompt is hidden until the final 30 seconds", () => {
  assert.equal(isPromptReady(1718, 2597), false);
  assert.equal(isPromptReady(2566, 2597), false);
  assert.equal(isPromptReady(2567, 2597), true);
  assert.equal(isPromptReady(2597, 2597), false);
});
