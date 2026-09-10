const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const providerDefinitions = source.match(/const PLAYER_PROVIDERS[^\r\n]*\r?\nfunction selectedPlayerProvider[^\r\n]*/)?.[0];
const start = source.indexOf("function playerURL");
const end = source.indexOf("function nextPlayerEpisode");

function buildURLFor(provider, item, progress = 0) {
  if (!providerDefinitions || start === -1 || end === -1) throw new Error("Player URL functions were not found.");
  const context = { URLSearchParams, currentPreferences:() => ({ playerProvider:provider, autoplayNext:true }) };
  vm.createContext(context);
  vm.runInContext(`${providerDefinitions}\n${source.slice(start, end)}`, context);
  return context.playerURL(item, progress);
}

test("an old Dulo setting safely falls back to the supported VidLink movie route", () => {
  const url = buildURLFor("dulo", { type:"movie", id:550 });
  assert.match(url, /^https:\/\/vidlink\.pro\/movie\/550\?/);
  assert.equal(url.includes("dulo"), false);
});

test("supported providers receive the saved playback second", () => {
  const item = { type:"tv", id:71712, season:4, episode:2 };
  assert.equal(new URL(buildURLFor("vidlink", item, 1712)).searchParams.get("startAt"), "1712");
  assert.equal(new URL(buildURLFor("vidsrc", item, 1712)).searchParams.get("t"), "1712");
  assert.equal(new URL(buildURLFor("vidking", item, 1712)).searchParams.get("progress"), "1712");
});

test("the player uses the saved start time unless a watch party supplies one", () => {
  assert.match(source, /playerURL\(p, startAt\)/);
  assert.match(source, /party\.code \? Math\.max\(0, Number\(party\.syncPosition\) \|\| 0\) : Math\.max\(0, Number\(p\.startAt\) \|\| 0\)/);
});
