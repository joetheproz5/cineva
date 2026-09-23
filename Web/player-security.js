/* Shared, dependency-free validation for messages received from embedded players. */
(function attachPlayerSecurity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEVENPlayerSecurity = api;
})(typeof window === "undefined" ? globalThis : window, function createPlayerSecurity() {
  const PROVIDER_ORIGINS = Object.freeze({
    vidsrc: "https://vidsrc.sbs",
    "2embed": "https://www.2embed.online",
    cinesrc: "https://cinesrc.st",
    vidfast: "https://vidfast.vc",
    multiembed: "https://multiembed.mov"
  });
  const MAX_DURATION_SECONDS = 172800;

  function originFor(provider) { return PROVIDER_ORIGINS[provider] || null; }
  function isFiniteNumber(value) { return typeof value === "number" && Number.isFinite(value); }
  function validPlayerEvent(payload) {
    const data = payload?.data;
    return payload?.type === "PLAYER_EVENT"
      && data && typeof data === "object"
      && typeof data.event === "string" && data.event.length > 0 && data.event.length <= 64
      && isFiniteNumber(data.currentTime) && data.currentTime >= 0
      && isFiniteNumber(data.duration) && data.duration > 0 && data.duration <= MAX_DURATION_SECONDS
      && data.currentTime <= data.duration + 5;
  }
  // Providers differ in how they announce progress; normalize everything into the
  // PLAYER_EVENT shape the app already understands.
  function normalizePlayerEvent(data) {
    if (!data || typeof data !== "object") return null;
    const type = String(data.type || "");
    if (type === "PLAYER_EVENT" && data.data && typeof data.data === "object") return data;
    if (type === "MEDIA_DATA" && data.data && typeof data.data === "object") {
      const media = data.data;
      return validPlayerEvent({ type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:media.currentTime, duration:media.duration } }) ? { type:"PLAYER_EVENT", data:{ event:"timeupdate", currentTime:media.currentTime, duration:media.duration } } : null;
    }
    if (type.startsWith("cinesrc:")) {
      const event = type.slice("cinesrc:".length);
      if (["play", "pause", "seeking", "seeked", "ended"].includes(event)) return { type:"PLAYER_EVENT", data:{ event, currentTime:0, duration:0 } };
      if (["timeupdate", "loadedmetadata"].includes(event)) return validPlayerEvent({ type:"PLAYER_EVENT", data:{ event, currentTime:data.currentTime, duration:data.duration } }) ? { type:"PLAYER_EVENT", data:{ event, currentTime:data.currentTime, duration:data.duration } } : null;
    }
    return null;
  }

  function isTrustedPlayerMessage(event, iframe, provider) {
    const normalized = normalizePlayerEvent(event?.data);
    return Boolean(normalized)
      && Boolean(iframe?.contentWindow)
      && event?.source === iframe.contentWindow
      && event?.origin === originFor(provider)
      && validPlayerEvent(normalized);
  }
  // CineSrc answers command getters (getCurrentTime, getDuration) with a
  // cinesrc:response postMessage. Validate those replies so the progress poller
  // only consumes numbers from the real player frame.
  function validPlayerResponse(data) {
    return data?.type === "cinesrc:response"
      && typeof data.command === "string" && data.command.length > 0 && data.command.length <= 64
      && isFiniteNumber(data.result) && data.result >= 0 && data.result <= MAX_DURATION_SECONDS;
  }
  function playerCommandFrame(provider) {
    return provider === "cinesrc" ? "https://cinesrc.st" : null;
  }

  return { PROVIDER_ORIGINS, originFor, validPlayerEvent, normalizePlayerEvent, isTrustedPlayerMessage, validPlayerResponse, playerCommandFrame };
});
