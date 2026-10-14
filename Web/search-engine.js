/* Search data shared by desktop, mobile and installed web apps. */
(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  root.SEVENSearch = engine;
})(typeof window === "undefined" ? globalThis : window, function () {
  const defaults = { type:"all", scope:"all", genre:"", year:"", language:"" };
  const clean = value => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const nameOf = item => item.title || item.name || "";
  const typeOf = item => item.type || item.media_type || (item.title ? "movie" : "tv");
  function similarity(left, right) {
    const a = clean(left), b = clean(right);
    if (!a || !b) return 0;
    const row = Array.from({ length:b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = old;
      }
    }
    return 1 - row[b.length] / Math.max(a.length, b.length);
  }
  function create(query, seeds = [], filters = {}) {
    return { query:String(query).trim().slice(0, 160), resolvedQuery:"", correction:"", suggestion:"", filters:{ ...defaults, ...filters }, seeds,
      raw:[], people:[], credits:null, person:null, page:0, totalPages:1, initialized:false, items:[], limit:20, loading:false, exhausted:false, error:"" };
  }
  function configure(view, filters = {}, person = undefined) {
    const next = { ...view, filters:{ ...view.filters, ...filters }, items:[], limit:20, loading:false, error:"" };
    if (person !== undefined || filters.scope && filters.scope !== view.filters.scope) {
      next.person = person || null; next.credits = null;
    }
    return next;
  }
  function matches(item, filters) {
    const type = typeOf(item), genre = String(filters.genre).split(":")[type === "tv" ? 1 : 0];
    if (filters.type !== "all" && type !== filters.type) return false;
    if (filters.genre && (!genre || !(item.genre_ids || (item.genres || []).map(value => value.id)).includes(Number(genre)))) return false;
    if (filters.year && !(item.release_date || item.first_air_date || "").startsWith(filters.year)) return false;
    if (filters.language && item.original_language !== filters.language) return false;
    return true;
  }
  function unique(items) {
    const seen = new Set();
    return items.filter(item => {
      const type = typeOf(item), key = `${type}:${item.id}`;
      if (!["movie", "tv"].includes(type) || !item.id || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(item => ({ ...item, type:typeOf(item) }));
  }
  function roleFor(view) {
    if (["actor", "director"].includes(view.filters.scope)) return view.filters.scope;
    return view.person?.known_for_department === "Directing" ? "director" : "actor";
  }
  async function initialize(view, fetchPage) {
    let query = view.query, payload = await fetchPage("search/multi", { query, page:1, include_adult:false });
    if (!(payload.results || []).length) {
      const simplified = query.replace(/\b(latest|series|tv show|movie|film|trailer|official)\b/gi, " ").replace(/\s+/g, " ").trim();
      const seed = view.seeds.map(item => ({ name:nameOf(item), score:similarity(query, nameOf(item)) })).sort((a, b) => b.score - a.score)[0];
      const alternatives = [...new Set([simplified !== query && simplified.length >= 2 ? simplified : "", seed?.score >= .78 ? seed.name : ""].filter(Boolean))];
      for (const alternative of alternatives.slice(0, 2)) {
        const found = await fetchPage("search/multi", { query:alternative, page:1, include_adult:false });
        if (found.results?.length) { query = alternative; payload = found; break; }
      }
      // A short prefix retrieves candidates; only close spellings can replace the query.
      if (!payload.results?.length && clean(view.query).length >= 5) {
        const words = view.query.split(/\s+/), prefix = words.length > 1 ? words.sort((a,b) => b.length-a.length)[0] : view.query.slice(0, Math.max(3, Math.ceil(view.query.length / 2)));
        const found = await fetchPage("search/multi", { query:prefix, page:1, include_adult:false });
        const candidate = (found.results || []).map(item => ({ item, score:Math.max(similarity(view.query, nameOf(item)), similarity(view.query, item.original_title || item.original_name)) })).filter(entry => entry.score >= .78).sort((a,b) => b.score-a.score)[0];
        if (candidate) { query = nameOf(candidate.item); payload = await fetchPage("search/multi", { query, page:1, include_adult:false }); }
      }
    }
    view.resolvedQuery = query;
    view.correction = clean(query) !== clean(view.query) ? query : "";
    // Keep legitimate exact matches, but offer a better-known close spelling.
    if (!view.correction && payload.results?.length > 0 && payload.results.length < 5 && Number(payload.total_pages || 1) <= 1 && clean(query).length >= 5) {
      const prefix = query.includes(" ") ? query.split(/\s+/).sort((a,b)=>b.length-a.length)[0] : query.slice(0, Math.max(3, Math.ceil(query.length / 2)));
      const candidates = [...view.seeds];
      try { candidates.push(...(await fetchPage("search/multi", { query:prefix, page:1, include_adult:false })).results || []); } catch { /* Optional suggestions cannot break a valid search. */ }
      const popularity = Math.max(1, ...(payload.results || []).map(item => Number(item.popularity) || 0));
      const alternative = candidates.filter(item => clean(nameOf(item)) !== clean(query) && similarity(query,nameOf(item)) >= .78 && Number(item.popularity || 0) > popularity * 4).sort((a,b)=>Number(b.popularity)-Number(a.popularity))[0];
      if (alternative) view.suggestion = nameOf(alternative);
    }
    view.raw = unique((payload.results || []).filter(item => item.media_type !== "person"));
    view.people = (payload.results || []).filter(item => item.media_type === "person" && ["Acting", "Directing"].includes(item.known_for_department)).slice(0, 6);
    view.page = 1; view.totalPages = Math.min(Number(payload.total_pages) || 1, 500); view.initialized = true;
  }
  async function load(view, fetchPage, allowed = () => true, isCurrent = () => true, more = false) {
    if (view.loading || !view.query || !isCurrent()) return;
    view.loading = true; view.error = "";
    const target = more ? view.limit + 20 : view.limit;
    try {
      if (!view.initialized) await initialize(view, fetchPage);
      if (!isCurrent()) return;
      if (!view.person && view.filters.scope !== "titles") {
        const person = view.people.find(person => similarity(view.resolvedQuery, person.name) >= .9);
        const exactTitle = view.raw.some(item => clean(nameOf(item)) === clean(view.resolvedQuery));
        if (person && (view.filters.scope !== "all" || !exactTitle)) view.person = person;
      }
      if (view.person && !view.credits) view.credits = await fetchPage(`person/${Number(view.person.id)}/combined_credits`);
      if (!isCurrent()) return;
      let source;
      if (view.person) {
        const knownFor = new Set((view.person.known_for || []).map(item => `${typeOf(item)}:${item.id}`));
        const rank = item => (knownFor.has(`${typeOf(item)}:${item.id}`) ? 1000 : 0) + Number(item.popularity || 0) * (/\b(self|himself|herself|archive footage)\b/i.test(item.character || "") || (item.genre_ids || []).some(id => [10763,10764,10767].includes(id)) ? .02 : 1);
        source = unique(roleFor(view) === "director" ? (view.credits.crew || []).filter(item => item.job === "Director") : view.credits.cast || []).sort((a,b) => rank(b) - rank(a));
      } else if (["actor", "director"].includes(view.filters.scope)) source = [];
      else {
        let scans = 0;
        while (view.raw.filter(item => matches(item, view.filters) && allowed(item)).length < target && view.page < view.totalPages && scans++ < 5) {
          const payload = await fetchPage("search/multi", { query:view.resolvedQuery, page:view.page + 1, include_adult:false });
          if (!isCurrent()) return;
          view.page++; view.raw = unique([...view.raw, ...(payload.results || []).filter(item => item.media_type !== "person")]);
        }
        source = view.raw;
      }
      const eligible = source.filter(item => matches(item, view.filters) && allowed(item));
      view.items = eligible.slice(0, target); view.limit = target;
      view.exhausted = eligible.length <= target && (!!view.person || ["actor", "director"].includes(view.filters.scope) || view.page >= view.totalPages);
    } catch (error) { view.error = error.message || "Search is unavailable. Try again."; }
    finally { view.loading = false; }
  }
  return { defaults, create, configure, load, matches, similarity, roleFor };
});
