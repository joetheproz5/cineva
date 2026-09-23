const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const providerList = source.match(/const PLAYER_PROVIDERS[^\r\n]*/)?.[0];
const selectedProvider = source.match(/function selectedPlayerProvider[^\r\n]*/)?.[0];
const providerDefinitions = providerList && selectedProvider ? `${providerList}\n${selectedProvider}` : null;
const start = source.indexOf("function playerURL");
const end = source.indexOf("function nextPlayerEpisode");

function buildURLFor(provider, item, progress = 0) {
  if (!providerDefinitions || start === -1 || end === -1) throw new Error("Player URL functions were not found.");
  const context = { URLSearchParams, currentPreferences:() => ({ playerProvider:provider, autoplayNext:true }) };
  vm.createContext(context);
  vm.runInContext(`${providerDefinitions}\n${source.slice(start, end)}`, context);
  return context.playerURL(item, progress);
}

test("only VidSrc and 2Embed remain as supported providers", () => {
  assert.deepEqual([...providerList.match(/"([^"]+)"/g)].map(value => value.replaceAll('"', "")), ["vidsrc", "2embed"]);
});

test("removed providers and unknown settings safely fall back to the VidSrc movie route", () => {
  for (const removed of ["vidlink", "vidking", "dulo"]) {
    const url = buildURLFor(removed, { type:"movie", id:550 });
    assert.match(url, /^https:\/\/vidsrc\.sbs\/embed\/movie\/550\?/);
    assert.equal(url.includes(removed), false);
  }
});

test("VidSrc receives the saved playback second and 2Embed stays parameter-free", () => {
  const item = { type:"tv", id:71712, season:4, episode:2 };
  assert.equal(new URL(buildURLFor("vidsrc", item, 1712)).searchParams.get("t"), "1712");
  assert.equal(new URL(buildURLFor("2embed", item, 1712)).search, "");
});

test("the player uses the saved start time unless a watch party supplies one", () => {
  assert.match(source, /playerURL\(p, startAt\)/);
  assert.match(source, /party\.code \? Math\.max\(0, Number\(party\.syncPosition\) \|\| 0\) : Math\.max\(0, Number\(p\.startAt\) \|\| 0\)/);
});

test("VidLink and Vidking are fully absent from the web app source", () => {
  assert.doesNotMatch(source, /vidlink/i);
  assert.doesNotMatch(source, /vidking/i);
});
