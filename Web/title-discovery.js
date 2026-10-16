/* Public TMDB metadata only. Progress and profile restrictions are evaluated at use time. */
(function (root, factory) {
  const discovery = factory();
  if (typeof module === "object" && module.exports) module.exports = discovery;
  root.SEVENTitleDiscovery = discovery;
})(typeof window === "undefined" ? globalThis : window, function () {
  function todayKey(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function dateOf(item) {
    const value = String(item?.release_date || item?.first_air_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value ? value : "";
  }
  function released(item, today = todayKey()) { const date = dateOf(item); return !!date && date <= today; }
  function normalize(item, type) {
    if (!item || !Number.isSafeInteger(Number(item.id)) || Number(item.id) <= 0) return null;
    if (item.media_type && item.media_type !== type) return null;
    if (item.type && ["movie", "tv"].includes(item.type) && item.type !== type) return null;
    const title = String(item.title || item.name || "").trim();
    if (!title) return null;
    return { ...item, id:Number(item.id), type };
  }
  function unique(items, type) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).map(item => normalize(item, type)).filter(item => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    });
  }
  function parts(collection, allowed = () => true) {
    return unique(collection?.parts, "movie").filter(allowed).sort((a, b) =>
      (dateOf(a) || "9999-99-99").localeCompare(dateOf(b) || "9999-99-99") || a.id - b.id);
  }
  function order(items, newest = false) {
    return newest ? [...items.filter(item => dateOf(item))].reverse().concat(items.filter(item => !dateOf(item))) : items.slice();
  }
  function progress(item, read = () => ({})) {
    const finite = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const saved = read(item) || {}, seconds = finite(saved.currentTime), duration = finite(saved.duration);
    const percent = Math.min(100, finite(saved.progress) || (duration ? seconds / duration * 100 : 0));
    const watched = saved.watched === true || percent >= 90;
    return { watched, percent:watched ? 100 : percent, seconds, resume:!watched && seconds >= 5 && (!duration || seconds < duration - 5) };
  }
  function summary(items, read, today = todayKey()) {
    const available = items.filter(item => released(item, today));
    const watched = available.filter(item => progress(item, read).watched).length;
    return { released:available.length, watched, next:available.find(item => !progress(item, read).watched) || null,
      complete:available.length > 0 && watched === available.length };
  }
  function related(items, { type, id, collection = [], allowed = () => true, today = todayKey() }) {
    const excluded = new Set([Number(id), ...collection.map(item => Number(item.id))]);
    return unique(items, type).filter(item => !excluded.has(item.id) && released(item, today) && allowed(item));
  }
  function createCache(fetchMetadata, { limit = 48, ttl = 900000, now = Date.now } = {}) {
    const entries = new Map();
    function get(path, params = {}, language = "English") {
      const key = JSON.stringify([language, path, Object.entries(params).sort()]), old = entries.get(key);
      if (old && now() - old.at < ttl) return old.promise;
      const entry = { at:now(), promise:Promise.resolve().then(() => fetchMetadata(path, params)) };
      entries.delete(key); entries.set(key, entry);
      while (entries.size > limit) entries.delete(entries.keys().next().value);
      entry.promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
      return entry.promise;
    }
    return { get };
  }
  // Failed sources retain their page so Retry never skips a failed page. One failed
  // source cannot suppress useful recommendations from the other one.
  function createRelated(type, id) {
    return { type, id:Number(id), sources:["recommendations", "similar"].map(name => ({ name, page:0, done:false })), items:[], errors:[] };
  }
  async function loadRelated(view, fetchMetadata) {
    if (view.pending) return view.pending;
    view.pending = (async () => {
      view.errors = [];
      const sources = view.sources.filter(source => !source.done);
      const responses = await Promise.allSettled(sources.map(source => fetchMetadata(`${view.type}/${view.id}/${source.name}`, { page:source.page + 1 })));
      responses.forEach((response, index) => {
        const source = sources[index];
        if (response.status === "rejected" || !Array.isArray(response.value?.results)) { view.errors.push(source.name); return; }
        source.page++;
        source.done = !response.value.results.length || source.page >= Math.min(500, Number(response.value.total_pages) || 1);
        view.items = unique([...view.items, ...response.value.results], view.type);
      });
      return view;
    })();
    try { return await view.pending; } finally { view.pending = null; }
  }
  return { todayKey, dateOf, released, normalize, parts, order, progress, summary, related, createCache, createRelated, loadRelated };
});
