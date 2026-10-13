/* Paging and filters shared by category collections and the full catalog. */
(function (root, factory) {
  const browser = factory();
  if (typeof module === "object" && module.exports) module.exports = browser;
  root.SEVENCatalogBrowser = browser;
})(typeof window === "undefined" ? globalThis : window, function () {
  const BATCH_SIZE = 20;
  const defaults = { type:"all", genre:"", date:"any", score:"", sort:"default", certificate:"" };
  const typeOf = item => item.type || item.media_type || (item.title ? "movie" : "tv");
  const dateOf = item => String(item.release_date || item.first_air_date || "");
  const genreFor = (genre, type) => String(genre || "").includes(":") ? String(genre).split(":")[type === "tv" ? 1 : 0] : String(genre || "");
  function dateBounds(date) {
    const year = new Date().getFullYear();
    if (date === "year") return [`${year}-01-01`, `${year}-12-31`];
    if (date === "five") return [`${year - 5}-01-01`, ""];
    if (date === "2010s") return ["2010-01-01", "2019-12-31"];
    if (date === "older") return ["", "2009-12-31"];
    return ["", ""];
  }
  function matches(item, filters) {
    const type = typeOf(item), genre = genreFor(filters.genre, type), date = dateOf(item), [from, to] = dateBounds(filters.date);
    if (filters.type !== "all" && type !== filters.type) return false;
    if (filters.genre && (!genre || !(item.genre_ids || (item.genres || []).map(entry => entry.id)).includes(Number(genre)))) return false;
    if (filters.score && Number(item.vote_average || 0) < Number(filters.score)) return false;
    if ((from || to) && (!date || from && date < from || to && date > to)) return false;
    return true;
  }
  function compare(a, b, sort) {
    if (sort === "vote_average.desc") return Number(b.vote_average || 0) - Number(a.vote_average || 0);
    if (["newest", "primary_release_date.desc", "first_air_date.desc"].includes(sort)) return dateOf(b).localeCompare(dateOf(a));
    if (sort === "popularity.desc") return Number(b.popularity || 0) - Number(a.popularity || 0);
    return 0;
  }
  function paramsFor(source, filters) {
    const params = { ...source.params, page:source.page + 1 };
    if (!source.path.startsWith("discover/")) return params;
    const type = source.type, dateKey = type === "tv" ? "first_air_date" : "primary_release_date", genre = genreFor(filters.genre, type);
    if (genre) params.with_genres = params.with_genres ? `${params.with_genres},${genre}` : genre;
    const [from, to] = dateBounds(filters.date);
    if (from) params[`${dateKey}.gte`] = [params[`${dateKey}.gte`] || "", from].sort().at(-1);
    if (to) params[`${dateKey}.lte`] = [params[`${dateKey}.lte`] || to, to].sort()[0];
    if (filters.score) { params["vote_average.gte"] = Math.max(Number(params["vote_average.gte"] || 0), Number(filters.score)); params["vote_count.gte"] = Math.max(Number(params["vote_count.gte"] || 0), 50); }
    if (filters.sort !== "default") params.sort_by = ["newest", "primary_release_date.desc", "first_air_date.desc"].includes(filters.sort) ? `${dateKey}.desc` : filters.sort;
    if (params.sort_by === "vote_average.desc") params["vote_count.gte"] = Math.max(Number(params["vote_count.gte"] || 0), 100);
    if (type === "movie" && filters.certificate) { params.certification_country = "US"; params.certification = filters.certificate; }
    return params;
  }
  function create(sources = [], localItems = [], filters = {}) {
    const selected = { ...defaults, ...filters };
    return { filters:selected, sources:sources.filter(source => selected.type === "all" || !source.type || source.type === selected.type).map(source => ({ ...source, params:{ ...source.params }, page:0, queue:[], done:false })), localItems:sources.length ? null : localItems.slice(), items:[], loading:false, exhausted:false, turn:0, error:"" };
  }
  async function loadBatch(view, fetchPage, allowed = () => true, isCurrent = () => true) {
    if (view.loading || view.exhausted) return;
    view.loading = true; view.error = "";
    const seen = new Set(view.items.map(item => `${typeOf(item)}:${item.id}`)), batch = [];
    const accept = item => allowed(item) && matches(item, view.filters) && !seen.has(`${typeOf(item)}:${item.id}`);
    try {
      if (view.localItems) {
        const candidates = view.localItems.filter(accept).sort((a, b) => compare(a, b, view.filters.sort));
        for (const item of candidates) { const key = `${typeOf(item)}:${item.id}`; if (seen.has(key)) continue; seen.add(key); batch.push(item); if (batch.length === BATCH_SIZE) break; }
        view.exhausted = candidates.every(item => seen.has(`${typeOf(item)}:${item.id}`));
      } else {
        while (batch.length < BATCH_SIZE && isCurrent()) {
          for (const source of view.sources) {
            source.queue = source.queue.filter(accept);
            while (!source.queue.length && !source.done && isCurrent()) {
              if (view.filters.genre && source.type && !genreFor(view.filters.genre, source.type)) { source.done = true; break; }
              const params = paramsFor(source, view.filters), response = await fetchPage(source.path, params);
              if (!isCurrent()) return;
              source.page = params.page;
              source.done = source.page >= Math.min(Number(response.total_pages) || 1, 500) || !(response.results || []).length;
              source.queue = (response.results || []).filter(item => item.media_type !== "person").map(item => ({ ...item, type:item.type || item.media_type || source.type || typeOf(item) })).filter(accept);
              if (view.filters.sort !== "default") source.queue.sort((a, b) => compare(a, b, view.filters.sort));
            }
          }
          const available = view.sources.filter(source => source.queue.length);
          if (!available.length) break;
          const source = view.filters.sort === "default" ? available[view.turn++ % available.length] : available.sort((a, b) => compare(a.queue[0], b.queue[0], view.filters.sort))[0];
          const item = source.queue.shift(), key = `${typeOf(item)}:${item.id}`;
          if (accept(item)) { seen.add(key); batch.push(item); }
        }
        view.exhausted = view.sources.every(source => source.done && !source.queue.some(accept));
      }
    } catch (error) { view.error = error.message || "Couldn’t load titles. Try again."; }
    finally {
      if (isCurrent()) { view.items.push(...batch); if (view.filters.sort !== "default") view.items.sort((a, b) => compare(a, b, view.filters.sort)); view.loading = false; }
      else view.loading = false;
    }
  }
  return { BATCH_SIZE, defaults, create, loadBatch, matches, compare, paramsFor, genreFor };
});
