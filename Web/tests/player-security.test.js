const assert = require("node:assert/strict");
const test = require("node:test");
const security = require("../player-security.js");

const validPayload = { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:42, duration:120 } };

test("accepts a well-formed player progress event", () => {
  assert.equal(security.validPlayerEvent(validPayload), true);
});

test("rejects malformed or impossible player progress", () => {
  assert.equal(security.validPlayerEvent({ type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:"42", duration:120 } }), false);
  assert.equal(security.validPlayerEvent({ type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:126, duration:120 } }), false);
  assert.equal(security.validPlayerEvent({ type:"OTHER_EVENT", data:validPayload.data }), false);
});

test("rejects a message from the wrong provider origin or frame", () => {
  const activeWindow = {}, otherWindow = {}, iframe = { contentWindow:activeWindow };
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://vidlink.pro", source:activeWindow, data:validPayload }, iframe, "vidlink"), true);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://attacker.invalid", source:activeWindow, data:validPayload }, iframe, "vidlink"), false);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://vidlink.pro", source:otherWindow, data:validPayload }, iframe, "vidlink"), false);
});
