/* Shared, dependency-free validation for messages received from embedded players. */
(function attachPlayerSecurity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEVENPlayerSecurity = api;
})(typeof window === "undefined" ? globalThis : window, function createPlayerSecurity() {
  const PROVIDER_ORIGINS = Object.freeze({
    vidlink: "https://vidlink.pro",
    vidsrc: "https://vidsrc.sbs",
    vidking: "https://www.vidking.net",
    "2embed": "https://www.2embed.online"
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
  function isTrustedPlayerMessage(event, iframe, provider) {
    return Boolean(iframe?.contentWindow)
      && event?.source === iframe.contentWindow
      && event?.origin === originFor(provider)
      && validPlayerEvent(event.data);
  }

  return { PROVIDER_ORIGINS, originFor, validPlayerEvent, isTrustedPlayerMessage };
});
