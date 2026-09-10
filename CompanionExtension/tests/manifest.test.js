const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(root, "rules", "popup-navigation.json"), "utf8"));

test("popup guard has scoped MV3 permissions and a static navigation rule", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["declarativeNetRequest", "storage", "tabs", "webNavigation"].sort());
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].action.type, "block");
  assert.deepEqual(rules[0].condition.resourceTypes, ["main_frame"]);
  assert.deepEqual(rules[0].condition.initiatorDomains.sort(), ["2embed.online", "vidking.net", "vidlink.pro", "vidsrc.sbs"]);
});
