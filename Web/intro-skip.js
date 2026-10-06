/* Pure helpers for TheIntroDB episode-intro data and playback timing. */
(function attachIntroSkip(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEVENIntroSkip = api;
})(typeof window === "undefined" ? globalThis : window, function createIntroSkip() {
  const MAX_MEDIA_MS = 48 * 60 * 60 * 1000;

  function mediaKey(media) {
    const id = Number(media?.id), season = Number(media?.season), episode = Number(media?.episode);
    if (media?.type !== "tv" || !Number.isInteger(id) || id < 1 || !Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) return null;
    return `${id}:${season}:${episode}`;
  }

  function requestURL(media) {
    const key = mediaKey(media);
    if (!key) return null;
    const [id, season, episode] = key.split(":");
    const query = new URLSearchParams({ tmdb_id:id, season, episode });
    return `https://api.theintrodb.org/v3/media?${query}`;
  }

  function normalizeIntro(payload) {
    if (!Array.isArray(payload?.intro)) return null;
    for (const raw of payload.intro) {
      const startMs = raw?.start_ms == null ? 0 : Number(raw.start_ms);
      const endMs = Number(raw?.end_ms);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs || endMs > MAX_MEDIA_MS) continue;
      const lengthMs = endMs - startMs;
      if (lengthMs < 5000 || lengthMs > 15 * 60 * 1000) continue;
      return { startMs, endMs };
    }
    return null;
  }

  function shouldShow(segment, currentTime, duration) {
    if (!segment) return false;
    const now = Number(currentTime), total = Number(duration), start = Number(segment.startMs) / 1000, end = Number(segment.endMs) / 1000;
    if (!Number.isFinite(now) || now < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || now >= end || now < Math.max(0, start - 3)) return false;
    return !(Number.isFinite(total) && total > 0 && end > total + 2);
  }

  function seekTarget(segment) {
    const end = Number(segment?.endMs);
    return Number.isFinite(end) && end > 0 && end <= MAX_MEDIA_MS ? Math.ceil(end / 1000) : null;
  }

  return { mediaKey, requestURL, normalizeIntro, shouldShow, seekTarget };
});
