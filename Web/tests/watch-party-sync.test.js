const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const followHelper = app.match(/function partyNeedsHostFollow\([^\n]+\}/)?.[0];

test("a guest automatically follows a changed host title or episode", () => {
  assert.ok(followHelper, "the pure host-follow decision helper exists");
  const context = vm.createContext({});
  const shouldFollow = vm.runInContext(`${followHelper}; partyNeedsHostFollow`, context);
  assert.equal(shouldFollow("movie:10:0:0", "movie:20:0:0", false, ""), true);
  assert.equal(shouldFollow("tv:10:1:2", "tv:10:1:1", true, "tv:10:1:1"), true);
  assert.equal(shouldFollow("movie:10:0:0", "movie:10:0:0", true, "movie:10:0:0"), false);
  assert.match(app, /if \(partyNeedsHostFollow\(data\.key, currentKey, party\.following, party\.followingKey\)\)[\s\S]*?void partyFollowHost\(\)/);
});

test("first sync always sends the host play state and waits for a ready player frame", () => {
  assert.match(app, /if \(!party\.didInitialSync\)\s*\{\s*party\.didInitialSync = true;\s*if \(party\.following\) partyApplyRemoteControl\("sync", party\.hostPosition, party\.hostPlaying\);/);
  assert.match(app, /if \(!frame \|\| frame\.dataset\.partyPlayerReady !== "true"\)\s*\{\s*party\.pendingControl =/);
  assert.match(app, /frame\.dataset\.partyPlayerReady = "true"/);
  assert.doesNotMatch(app, /party\.syncPosition = 0;/);
});
