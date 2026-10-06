const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const stats = require("../profile-stats.js");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const indexPage = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");

function entry(overrides = {}) {
  return {
    type:"tv", id:100, season:1, episode:1, title:"Example Series", posterPath:"/series.jpg",
    genreIds:[18, 80], currentTime:900, duration:1800, progress:50, watched:false,
    lastWatchedAt:"2026-09-28T18:00:00.000Z", ...overrides
  };
}

test("the recap tracker is included in the versioned online and offline app shell", () => {
    assert.ok(indexPage.indexOf("profile-stats.js?v=1") < indexPage.indexOf("app.js?v=322"));
  assert.match(serviceWorker, /"profile-stats\.js\?v=1"/);
  assert.match(appSource, /service-worker\.js\?v=322/);
});

test("first-time profile stats migrate saved positions without dropping existing history", () => {
  const profile = { id:"main" };
  const rows = [entry(), entry({ episode:2, currentTime:1200, progress:67 })];
  const result = stats.summarize(rows, profile);

  assert.equal(result.seconds, 2100);
  assert.equal(result.titlesStarted, 1);
  assert.equal(result.titles[0].seconds, 2100);
  assert.deepEqual(result.genres, [18, 80]);
  assert.equal(result.streak, 1);
  assert.equal(profile.watchStats.version, stats.VERSION);
});

test("profile watch time accumulates actual playback across repeats and survives reload", () => {
  const profile = { id:"main" }, watched = entry({ currentTime:900 });
  stats.ensureWatchStats(profile, [watched]);
  stats.addWatchTime(profile, { type:"tv", id:100, season:1, episode:1, title:"Example Series", genreIds:[18, 80] }, 40, new Date("2026-09-29T10:00:00.000Z"));
  stats.addWatchTime(profile, { type:"tv", id:100, season:1, episode:1, title:"Example Series", genreIds:[18, 80] }, 25, new Date("2026-09-29T10:01:00.000Z"));

  const restored = { watchStats:JSON.parse(JSON.stringify(profile.watchStats)) };
  const result = stats.summarize([watched], restored);
  assert.equal(result.seconds, 965);
  assert.equal(result.titles[0].seconds, 965);
  assert.equal(result.episodesWatched, 0);
});

test("device recovery merges newer local watch totals into cloud stats without replacing profile settings", () => {
  const cloud = { version:1, totalSeconds:100, byTitle:{ "movie:1":{ type:"movie", id:1, title:"One", seconds:100, genreIds:[28] } }, currentStreak:2, longestStreak:2, lastWatchedDay:"2026-09-27" };
  const device = { version:1, totalSeconds:160, byTitle:{ "movie:1":{ type:"movie", id:1, title:"One", seconds:120, genreIds:[28] }, "tv:2":{ type:"tv", id:2, title:"Two", seconds:40, genreIds:[18] } }, currentStreak:3, longestStreak:3, lastWatchedDay:"2026-09-28" };
  const profile = { id:"main", name:"My profile", watchStats:cloud, preferences:{ language:"English" } };
  const merged = stats.mergeWatchStats(profile.watchStats, device);
  profile.watchStats = merged;

  assert.equal(profile.name, "My profile");
  assert.equal(profile.preferences.language, "English");
  assert.equal(merged.totalSeconds, 160);
  assert.equal(merged.byTitle["movie:1"].seconds, 120);
  assert.equal(merged.byTitle["tv:2"].seconds, 40);
  assert.equal(merged.lastWatchedDay, "2026-09-28");
  assert.equal(merged.longestStreak, 3);
});

test("completed episodes are counted once and genre popularity counts unique shows, not episodes", () => {
  const rows = [
    entry({ episode:1, watched:true, progress:100 }),
    entry({ episode:2, watched:true, progress:100 }),
    entry({ type:"movie", id:200, title:"Example Movie", genreIds:[18], watched:true, progress:100, currentTime:120, duration:120 })
  ];
  const result = stats.summarize(rows, { id:"main" });
  assert.equal(result.episodesWatched, 2);
  assert.equal(result.moviesFinished, 1);
  assert.deepEqual(result.genres, [18, 80]);
});

test("playback days update a real consecutive-day streak and clear history resets all recap data", () => {
  const profile = { id:"main" };
  stats.addWatchTime(profile, { type:"movie", id:1, title:"One" }, 10, new Date("2026-09-27T23:59:00.000Z"));
  stats.addWatchTime(profile, { type:"movie", id:1, title:"One" }, 10, new Date("2026-09-28T00:01:00.000Z"));
  stats.addWatchTime(profile, { type:"movie", id:1, title:"One" }, 10, new Date("2026-09-30T00:01:00.000Z"));
  assert.equal(profile.watchStats.longestStreak, 2);
  assert.equal(profile.watchStats.currentStreak, 1);
  stats.clearWatchStats(profile);
  assert.equal(stats.summarize([], profile).seconds, 0);
  assert.equal(stats.summarize([], profile).titlesStarted, 0);
  assert.equal(profile.watchStats.longestStreak, 0);
});

test("the live player sampler counts forward playback for account stats and dashboard metrics, not seeks", () => {
  const start = appSource.indexOf("function samplePlaybackWatchTime(currentTime)");
  const sampler = appSource.slice(start, appSource.indexOf("\n}", start) + 2);
  let now = 1000;
  const profileEvents = [];
  const context = {
    playbackWatch:{ sample:null, buffered:0, bufferType:null, accessToken:null, batch:null, sending:false, timer:null },
    state:{ player:{ type:"movie", id:42 }, session:{ access_token:"account-token" } },
    Date:{ now:() => now }, clearTimeout(){},
    watchKey:item => `${item.type}:${item.id}`,
    analyticsAllowed:() => true,
    recordProfileWatchTime:(item, seconds) => profileEvents.push([item.id, seconds]),
    flushWatchTime(){}, scheduleWatchTimeFlush(){}, setTimeout:() => 1
  };
  vm.createContext(context);
  vm.runInContext(sampler, context);
  context.samplePlaybackWatchTime(100);
  now = 4000;
  context.samplePlaybackWatchTime(103);
  now = 7000;
  context.samplePlaybackWatchTime(106);
  now = 10000;
  context.samplePlaybackWatchTime(160); // a seek is not watch time

  assert.deepEqual(profileEvents, [[42, 3], [42, 3]]);
  assert.equal(context.playbackWatch.buffered, 6);
  assert.equal(context.playbackWatch.bufferType, "account");
});

test("Do Not Track suppresses admin analytics but preserves the member's own playback recap", () => {
  const start = appSource.indexOf("function samplePlaybackWatchTime(currentTime)");
  const sampler = appSource.slice(start, appSource.indexOf("\n}", start) + 2);
  let now = 1000;
  const profileEvents = [];
  const context = {
    playbackWatch:{ sample:null, buffered:0, bufferType:null, accessToken:null, batch:null, sending:false, timer:null },
    state:{ player:{ type:"movie", id:42 }, session:{ access_token:"account-token" } },
    Date:{ now:() => now }, clearTimeout(){}, watchKey:item => `${item.type}:${item.id}`,
    analyticsAllowed:() => false,
    recordProfileWatchTime:(item, seconds) => profileEvents.push([item.id, seconds]),
    flushWatchTime(){}, scheduleWatchTimeFlush(){}, setTimeout:() => 1
  };
  vm.createContext(context);
  vm.runInContext(sampler, context);
  context.samplePlaybackWatchTime(100);
  now = 4000;
  context.samplePlaybackWatchTime(103);

  assert.deepEqual(profileEvents, [[42, 3]]);
  assert.equal(context.playbackWatch.buffered, 0);
});
