const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const providerDefinitions = source.match(/const PLAYER_PROVIDERS[^\r\n]*\r?\nfunction selectedPlayerProvider[^\r\n]*/)?.[0];
const start = source.indexOf("function playerURL");
const end = source.indexOf("function nextPlayerEpisode");

function buildURLFor(provider, item) {
  if (!providerDefinitions || start === -1 || end === -1) throw new Error("Player URL functions were not found.");
  const context = { URLSearchParams, currentPreferences:() => ({ playerProvider:provider, autoplayNext:true }) };
  vm.createContext(context);
  vm.runInContext(`${providerDefinitions}\n${source.slice(start, end)}`, context);
  return context.playerURL(item);
}

test("an old Dulo setting safely falls back to the supported VidLink movie route", () => {
  const url = buildURLFor("dulo", { type:"movie", id:550 });
  assert.match(url, /^https:\/\/vidlink\.pro\/movie\/550\?/);
  assert.equal(url.includes("dulo"), false);
});
