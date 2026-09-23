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
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://vidsrc.sbs", source:activeWindow, data:validPayload }, iframe, "vidsrc"), true);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://attacker.invalid", source:activeWindow, data:validPayload }, iframe, "vidsrc"), false);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://vidsrc.sbs", source:otherWindow, data:validPayload }, iframe, "vidsrc"), false);
});

test("new provider origins are registered", () => {
  assert.equal(security.originFor("cinesrc"), "https://cinesrc.st");
  assert.equal(security.originFor("vidfast"), "https://vidfast.vc");
  assert.equal(security.originFor("multiembed"), "https://multiembed.mov");
});

test("CineSrc timeupdate events are normalized into PLAYER_EVENT progress", () => {
  const message = { type:"cinesrc:timeupdate", currentTime:42, duration:120 };
  const normalized = security.normalizePlayerEvent(message);
  assert.deepEqual(normalized, { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:42, duration:120 } });
  assert.equal(security.validPlayerEvent(normalized), true);
  const iframe = { contentWindow:{} };
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://cinesrc.st", source:iframe.contentWindow, data:message }, iframe, "cinesrc"), true);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://cinesrc.st", source:iframe.contentWindow, data:{ type:"cinesrc:timeupdate", currentTime:"42", duration:120 } }, iframe, "cinesrc"), false);
  assert.equal(security.isTrustedPlayerMessage({ origin:"https://attacker.invalid", source:iframe.contentWindow, data:message }, iframe, "cinesrc"), false);
});

test("CineSrc lifecycle events normalize with safe placeholder times", () => {
  assert.deepEqual(security.normalizePlayerEvent({ type:"cinesrc:ended" }), { type:"PLAYER_EVENT", data:{ event:"ended", currentTime:0, duration:0 } });
  assert.equal(security.normalizePlayerEvent({ type:"cinesrc:volumechange", volume:0.5 }), null);
});

test("VidFast PLAYER_EVENT and MEDIA_DATA payloads are accepted", () => {
  const vidfastEvent = { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:30, duration:100, tmdbId:550, mediaType:"movie" } };
  assert.equal(security.normalizePlayerEvent(vidfastEvent), vidfastEvent);
  const mediaData = { type:"MEDIA_DATA", data:{ currentTime:30, duration:100 } };
  assert.deepEqual(security.normalizePlayerEvent(mediaData), { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:30, duration:100 } });
  assert.equal(security.normalizePlayerEvent({ type:"MEDIA_DATA", data:{ currentTime:999, duration:100 } }), null);
});
