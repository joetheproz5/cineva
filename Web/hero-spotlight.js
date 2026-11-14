/* Home spotlight only. The startup ident and profile handoff are independent. */
(function (root, factory) {
  const spotlight = factory(root);
  if (typeof module === "object" && module.exports) module.exports = spotlight;
  root.SEVENHero = spotlight;
})(typeof window === "undefined" ? globalThis : window, function (root) {
  function createImageLoader({ ImageClass = root.Image, limit = 5, timeout = 15000 } = {}) {
    const entries = new Map();
    function load(url) {
      if (!url) return Promise.reject(new Error("No spotlight artwork"));
      const old = entries.get(url);
      if (old) { entries.delete(url); entries.set(url, old); return old; }
      const pending = new Promise((resolve, reject) => {
        const image = new ImageClass(); let settled = false;
        const timer = setTimeout(() => finish(new Error("Spotlight artwork timed out")), timeout);
        function finish(error) {
          if (settled) return; settled = true; clearTimeout(timer);
          image.onload = image.onerror = null;
          if (error) reject(error); else resolve({ url, image });
        }
        image.decoding = "async";
        image.onload = async () => {
          try {
            if (typeof image.decode === "function") await image.decode();
            if (!image.naturalWidth) throw new Error("Empty spotlight artwork");
            finish();
          } catch (error) { finish(error); }
        };
        image.onerror = () => finish(new Error("Spotlight artwork unavailable"));
        image.src = url;
      });
      entries.set(url, pending);
      while (entries.size > limit) entries.delete(entries.keys().next().value);
      pending.catch(() => { if (entries.get(url) === pending) entries.delete(url); });
      return pending;
    }
    async function first(urls) {
      for (const url of [...new Set(urls.filter(Boolean))]) {
        try { return await load(url); } catch { /* Try the poster/local fallback before exposing this title. */ }
      }
      throw new Error("No spotlight artwork could be displayed");
    }
    return { load, first };
  }
  const loader = createImageLoader();
  let active = null;
  const artwork = item => [item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : "", posterOf(item), STILL_FALLBACK];
  function valid(view) { return active === view && document.querySelector("#featured") === view.element; }
  function preload(pool = []) {
    // Keep the decoded working set small; do not decode a dozen full-size backdrops on phones.
    pool.slice(0, 2).forEach(item => { void loader.first(artwork(item)).catch(() => {}); });
  }
  function warmNeighbours(view) {
    if (!valid(view) || view.pool.length < 2) return;
    const next = view.pool[(view.index + 1) % view.pool.length];
    void loader.first(artwork(next)).catch(() => {});
  }
  function cancel() {
    if (!active) return;
    const view = active; active = null; view.ticket++;
    view.animations.forEach(animation => animation.cancel());
  }
  function panel(item, url = STILL_FALLBACK) {
    const template = document.createElement("template");
    template.innerHTML = featuredMarkup(item);
    const slide = document.createElement("div");
    slide.className = "spotlight-slide"; slide.dataset.spotlightTitle = `${contentType(item)}:${item.id}`;
    const backdrop = template.content.querySelector(".home-hero-backdrop");
    backdrop.style.backgroundImage = `url(${JSON.stringify(url)}), url(${JSON.stringify(STILL_FALLBACK)})`;
    slide.append(backdrop, template.content.querySelector(".home-hero-layout"));
    return slide;
  }
  function busy(view, value) {
    if (!valid(view)) return;
    view.loading = value;
    if (value) view.element.setAttribute("aria-busy", "true"); else view.element.removeAttribute("aria-busy");
  }
  async function select(index, direction = 1) {
    const view = active;
    if (!view || !valid(view) || !view.pool.length) return false;
    const count = view.pool.length, target = ((index % count) + count) % count;
    view.target = target;
    if (target === view.index && view.current) return false;
    const ticket = ++view.ticket;
    // Navigation must not wait for a remote image. Cancel any in-flight transition,
    // retain its current slide, and show the new title over the local fallback first.
    view.animations.forEach(animation => animation.cancel());
    view.animations = [];
    view.element.querySelectorAll(".spotlight-slide").forEach(slide => { if (slide !== view.current) slide.remove(); });
    const item = view.pool[target], previous = view.current, next = panel(item);
    view.element.append(next);
    view.current = next; view.index = target;
    state.featuredIndex = target; state.featured = item;
    view.element.querySelector(".spotlight-placeholder")?.remove();
    bindHeroControls();
    warmNeighbours(view);
    const backdrop = next.querySelector(".home-hero-backdrop");
    void loader.first(artwork(item)).then(ready => {
      if (!valid(view) || ticket !== view.ticket || view.current !== next || !backdrop) return;
      backdrop.style.backgroundImage = `url(${JSON.stringify(ready.url)}), url(${JSON.stringify(STILL_FALLBACK)})`;
    }).catch(() => {});
    const reduced = root.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!previous || reduced || typeof next.animate !== "function") {
      previous?.remove(); busy(view, false); return true;
    }
    busy(view, true);
    previous.setAttribute("aria-hidden", "true"); previous.inert = true;
    const offset = view.element.getBoundingClientRect().width * (direction < 0 ? -1 : 1);
    const options = { duration:620, easing:"cubic-bezier(.22,.72,.22,1)", fill:"both" };
    const outgoing = [...previous.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    const incoming = [...next.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    const animations = [
      ...outgoing.map(element => element.animate([{ transform:"translateX(0px)" }, { transform:`translateX(${-offset}px)` }], options)),
      ...incoming.map(element => element.animate([{ transform:`translateX(${offset}px)` }, { transform:"translateX(0px)" }], options))
    ];
    view.animations = animations;
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (previous !== view.current) previous.remove();
      // An older canceled transition must never cancel or clear a newer one.
      if (!valid(view) || ticket !== view.ticket) return;
      animations.forEach(animation => animation.cancel());
      if (view.animations === animations) view.animations = [];
      busy(view, false);
    });
    return true;
  }
  function move(direction = 1, { automatic = false } = {}) {
    const view = active;
    if (!view || !valid(view) || view.pool.length < 2 || automatic && (view.loading || document.hidden)) return Promise.resolve(false);
    return select(view.index + direction, direction);
  }
  function mount() {
    cancel();
    const element = document.querySelector("#featured");
    if (!element || state.route !== "home" || !state.featured) return;
    const pool = state.featuredPool.length ? state.featuredPool : [state.featured];
    // Keep the arrows and grading stationary; artwork and its copy move as one horizontal slide.
    element.classList.remove("hero-refresh"); element.classList.add("spotlight-ready");
    element.innerHTML = `<div class="home-hero-grade" aria-hidden="true"></div><div class="home-hero-shade"></div><div class="spotlight-placeholder" role="status" aria-label="Loading spotlight artwork"></div>${heroNavigation()}`;
    active = { element, pool:state.featuredPool, index:state.featuredIndex || 0, target:state.featuredIndex || 0, ticket:0, current:null, animations:[], loading:false };
    // A one-title fallback is also decoded before its copy is inserted.
    if (!state.featuredPool.length) { active.pool = state.featuredPool = pool; active.index = active.target = 0; }
    bindHeroControls();
    void select(active.index);
    warmNeighbours(active);
  }
  return { createImageLoader, mount, cancel, preload, select, move };
});
