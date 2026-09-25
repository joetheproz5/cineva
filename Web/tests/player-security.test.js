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

test("CineSrc native next-episode messages expose validated episode coordinates", () => {
  const message = { type:"cinesrc:nextepisode", season:5, episode:1, internalNavigation:true, source:"button" };
  const iframe = { contentWindow:{} };
  assert.deepEqual(security.normalizePlayerEpisodeChange(message), { season:5, episode:1, internalNavigation:true, source:"cinesrc" });
  assert.equal(security.isTrustedPlayerEpisodeChange({ origin:"https://cinesrc.st", source:iframe.contentWindow, data:message }, iframe, "cinesrc"), true);
  assert.equal(security.isTrustedPlayerEpisodeChange({ origin:"https://attacker.invalid", source:iframe.contentWindow, data:message }, iframe, "cinesrc"), false);
  assert.equal(security.normalizePlayerEpisodeChange({ ...message, episode:"next" }), null);
});

test("VidFast episode metadata and explicit next events normalize without accepting unknown origins", () => {
  const iframe = { contentWindow:{} };
  const message = { type:"PLAYER_EVENT", data:{ event:"timeupdate", season:4, episode:20, tmdbId:71712, currentTime:45, duration:120 } };
  assert.deepEqual(security.normalizePlayerEpisodeChange(message), { season:4, episode:20, showId:71712, internalNavigation:true, source:"vidfast" });
  assert.equal(security.isTrustedPlayerEpisodeChange({ origin:"https://vidfast.vc", source:iframe.contentWindow, data:message }, iframe, "vidfast"), true);
  assert.equal(security.isTrustedPlayerEpisodeChange({ origin:"https://attacker.invalid", source:iframe.contentWindow, data:message }, iframe, "vidfast"), false);
  assert.deepEqual(security.normalizePlayerEpisodeChange({ type:"PLAYER_EVENT", data:{ event:"next_episode" } }), { next:true, internalNavigation:true, source:"vidfast" });
  assert.equal(security.normalizePlayerEpisodeChange({ type:"PLAYER_EVENT", data:{ event:"timeupdate", season:"4", episode:"20", tmdbId:"bad" } }), null);
});

test("VidFast PLAYER_EVENT and MEDIA_DATA payloads are accepted", () => {
  const vidfastEvent = { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:30, duration:100, tmdbId:550, mediaType:"movie" } };
  assert.equal(security.normalizePlayerEvent(vidfastEvent), vidfastEvent);
  const mediaData = { type:"MEDIA_DATA", data:{ currentTime:30, duration:100 } };
  assert.deepEqual(security.normalizePlayerEvent(mediaData), { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:30, duration:100 } });
  assert.equal(security.normalizePlayerEvent({ type:"MEDIA_DATA", data:{ currentTime:999, duration:100 } }), null);
});

test("CineSrc command responses are validated for the progress poller", () => {
  assert.equal(security.validPlayerResponse({ type:"cinesrc:response", command:"getCurrentTime", result:613.4 }), true);
  assert.equal(security.validPlayerResponse({ type:"cinesrc:response", command:"getDuration", result:5400 }), true);
  assert.equal(security.validPlayerResponse({ type:"cinesrc:response", command:"getCurrentTime", result:"613" }), false);
  assert.equal(security.validPlayerResponse({ type:"cinesrc:response", command:"getCurrentTime", result:-4 }), false);
  assert.equal(security.validPlayerResponse({ type:"cinesrc:response", command:"getCurrentTime" }), false);
  assert.equal(security.validPlayerResponse({ type:"PLAYER_EVENT", command:"getCurrentTime", result:5 }), false);
});

test("only CineSrc exposes a postMessage command target", () => {
  assert.equal(security.playerCommandFrame("cinesrc"), "https://cinesrc.st");
  for (const provider of ["vidsrc", "2embed", "vidfast", "multiembed"]) assert.equal(security.playerCommandFrame(provider), null);
});
