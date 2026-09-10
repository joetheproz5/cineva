const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const nextEpisodeLogic = source.match(/function nextPlayerEpisode[^\r\n]*/)?.[0];

test("next episode always resolves to an episode number after the current one", () => {
  if (!nextEpisodeLogic) throw new Error("Next-episode logic was not found.");
  const context = {
    state:{ series:{ id:71712 }, selectedSeason:4, episodes:{ episodes:[{ episode_number:9 }, { episode_number:7 }, { episode_number:8 }] } }
  };
  vm.createContext(context);
  vm.runInContext(nextEpisodeLogic, context);
  assert.equal(context.nextPlayerEpisode({ type:"tv", id:71712, season:4, episode:7 }).episode_number, 8);
});
