const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const continueLogic = source.match(/function continueWatching\(\) \{[\s\S]*?\n\}/)?.[0];

function getContinueWatching({ session, profileId = "main", records = [] }) {
  if (!continueLogic) throw new Error("Continue Watching logic was not found.");
  const context = { state:{ session, accountProgress:records }, activeProfileId:() => profileId };
  vm.createContext(context);
  vm.runInContext(continueLogic, context);
  return Array.from(context.continueWatching());
}

const movie = { key:"seven-progress-main-movie-10-0-0", type:"movie", id:10, title:"Account movie", duration:7200, currentTime:3600, progress:50, watched:false, lastWatchedAt:"2026-09-25T12:00:00.000Z" };

test("guests never get a Continue Watching row from local browser progress", () => {
  assert.deepEqual(getContinueWatching({ session:null, records:[movie] }), []);
  assert.doesNotMatch(continueLogic, /progressEntries\(|localStorage/);
});

test("signed-in Continue Watching uses only the active profile's account records", () => {
  const otherProfile = { ...movie, key:"seven-progress-kids-movie-11-0-0", id:11, title:"Other profile" };
  const completed = { ...movie, key:"seven-progress-main-movie-12-0-0", id:12, title:"Completed", currentTime:7200, progress:100, watched:true };
  assert.deepEqual(getContinueWatching({ session:{ access_token:"account-token" }, records:[movie, otherProfile, completed] }).map(item => item.title), ["Account movie"]);
});
