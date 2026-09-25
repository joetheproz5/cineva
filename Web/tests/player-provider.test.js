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

test("CineSrc, VidFast, MultiEmbed, VidSrc, and 2Embed are the supported providers", () => {
  assert.deepEqual([...providerList.match(/"([^"]+)"/g)].map(value => value.replaceAll('"', "")), ["cinesrc", "vidfast", "multiembed", "vidsrc", "2embed"]);
});

test("CineSrc is the default provider and unknown settings fall back to it", () => {
  assert.match(source, /playerProvider:"cinesrc"/);
  assert.match(selectedProvider, /return PLAYER_PROVIDERS\.includes\(provider\) \? provider : "cinesrc"/);
  const url = buildURLFor("dulo", { type:"movie", id:550 });
  assert.match(url, /^https:\/\/cinesrc\.st\/embed\/movie\/550\?/);
});

test("CineSrc embeds use TMDB routes, autonext, resume, and brand color", () => {
  const movie = new URL(buildURLFor("cinesrc", { type:"movie", id:550 }, 1712));
  assert.equal(`${movie.origin}${movie.pathname}`, "https://cinesrc.st/embed/movie/550");
  assert.equal(movie.searchParams.get("autoplay"), "true");
  assert.equal(movie.searchParams.get("autonext"), "true");
  assert.equal(movie.searchParams.get("t"), "1712");
  assert.equal(movie.searchParams.get("continueprompt"), "false");
  const show = new URL(buildURLFor("cinesrc", { type:"tv", id:71712, season:4, episode:2 }, 0));
  assert.equal(`${show.origin}${show.pathname}`, "https://cinesrc.st/embed/tv/71712");
  assert.equal(show.searchParams.get("s"), "4");
  assert.equal(show.searchParams.get("e"), "2");
});

test("VidFast embeds enable autoPlay, autoNext, theme, and startAt resume", () => {
  const movie = new URL(buildURLFor("vidfast", { type:"movie", id:550 }, 640));
  assert.equal(`${movie.origin}${movie.pathname}`, "https://vidfast.vc/movie/550");
  assert.equal(movie.searchParams.get("autoPlay"), "true");
  assert.equal(movie.searchParams.get("autoNext"), "true");
  assert.equal(movie.searchParams.get("startAt"), "640");
  const show = new URL(buildURLFor("vidfast", { type:"tv", id:71712, season:4, episode:2 }));
  assert.equal(show.pathname, "/tv/71712/4/2");
  assert.equal(show.searchParams.has("startAt"), false);
});

test("MultiEmbed uses the video_id query format for movies and episodes", () => {
  const movie = new URL(buildURLFor("multiembed", { type:"movie", id:550 }));
  assert.equal(`${movie.origin}${movie.pathname}`, "https://multiembed.mov/");
  assert.equal(movie.searchParams.get("video_id"), "550");
  const show = new URL(buildURLFor("multiembed", { type:"tv", id:71712, season:4, episode:2 }, 30));
  assert.equal(show.searchParams.get("video_id"), "71712");
  assert.equal(show.searchParams.get("s"), "4");
  assert.equal(show.searchParams.get("e"), "2");
  assert.equal(show.searchParams.get("t"), "30");
});

test("VidSrc keeps resume support and 2Embed stays parameter-free", () => {
  const item = { type:"tv", id:71712, season:4, episode:2 };
  assert.equal(new URL(buildURLFor("vidsrc", item, 1712)).searchParams.get("t"), "1712");
  assert.equal(new URL(buildURLFor("2embed", item, 1712)).search, "");
});

test("the player uses the saved start time unless a watch party supplies one", () => {
  assert.match(source, /playerURL\(p, startAt\)/);
  assert.match(source, /party\.code \? Math\.max\(0, Number\(party\.syncPosition\) \|\| 0\) : Math\.max\(0, Number\(p\.startAt\) \|\| 0\)/);
});

test("removed providers are migrated to CineSrc and never reach a playback URL", () => {
  assert.match(source, /\["cinepro", "vidlink", "vidking"\]\.includes\(state\.account\.preferences\.playerProvider\)/);
  const urlFunctions = source.slice(start, end);
  for (const removed of ["cinepro", "vidlink", "vidking", "dulo"]) assert.equal(urlFunctions.includes(removed), false);
});

test("CineSrc progress is polled via getCurrentTime and getDuration commands", () => {
  assert.match(source, /function startPlayerProgressPolling/);
  assert.match(source, /sendPlayerCommand\(provider, "getCurrentTime"\)/);
  assert.match(source, /sendPlayerCommand\(provider, "getDuration"\)/);
  assert.match(source, /type:"cinesrc:command", command, args:\[\]/);
  assert.match(source, /bindPlayerControlLift\(\); ensurePlayerContext\(p\); startPlayerProgressPolling\(\);/);
  assert.match(source, /if \(state\.route !== "player"\) stopPlayerProgressPolling\(\);/);
  assert.match(source, /function handlePlayerResponse/);
});

test("the existing server fullscreen control receives mobile-compatible permission", () => {
  assert.match(source, /allowfullscreen webkitallowfullscreen mozallowfullscreen/);
  assert.equal(source.includes("data-player-fullscreen"), false);
});
