const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = app.indexOf("function renderPartyPanel()");
const end = app.indexOf("\nfunction showPartyModal()", start);
const renderPartyPanel = start >= 0 && end > start ? app.slice(start, end) : "";

test("watch-party updates keep the chat form mounted while refreshing messages and status", () => {
  assert.match(renderPartyPanel, /if \(!panel\.querySelector\("\[data-party-chat\]"\)\)\s*\{\s*panel\.innerHTML =/);
  assert.match(renderPartyPanel, /panel\.querySelector\("\[data-party-chat\]"\)\.onsubmit =/);
  assert.match(renderPartyPanel, /panel\.querySelector\("\[data-party-state\]"\)\.innerHTML = stateContent/);
  assert.match(renderPartyPanel, /log\.innerHTML = party\.chat\.length/);
  assert.equal((renderPartyPanel.match(/panel\.innerHTML =/g) || []).length, 2, "the panel is replaced only for an error screen or initial setup");
});
