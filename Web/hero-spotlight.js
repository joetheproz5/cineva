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
  const scope = () => `${state.user?.id || "guest"}:${activeProfileId()}:${currentPreferences().language}`;
  const artwork = item => [item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : "", posterOf(item), STILL_FALLBACK];
  function valid(view) {
    return active === view && state.route === "home" && view.scope === scope() && view.pool === state.featuredPool && document.querySelector("#featured") === view.element;
  }
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
  function panel(item, url) {
    const template = document.createElement("template");
    template.innerHTML = featuredMarkup(item);
    const slide = document.createElement("div");
    slide.className = "spotlight-slide"; slide.dataset.spotlightTitle = `${contentType(item)}:${item.id}`;
    const backdrop = template.content.querySelector(".home-hero-backdrop");
    backdrop.style.backgroundImage = `url(${JSON.stringify(url)})`;
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
    if (target === view.index && view.current && !view.loading) return false;
    const ticket = ++view.ticket;
    busy(view, true);
    let ready;
    try { ready = await loader.first(artwork(view.pool[target])); }
    catch {
      if (valid(view) && ticket === view.ticket) {
        busy(view, false);
        if (!view.current) view.element.querySelector(".spotlight-placeholder")?.setAttribute("aria-label", "Spotlight unavailable. Try again.");
      }
      return false;
    }
    if (!valid(view) || ticket !== view.ticket) return false;
    await view.transition;
    if (!valid(view) || ticket !== view.ticket) return false;
    const next = panel(view.pool[target], ready.url), previous = view.current;
    view.element.append(next);
    view.current = next; view.index = target;
    state.featuredIndex = target; state.featured = view.pool[target];
    view.element.querySelector(".spotlight-placeholder")?.remove();
    const counter = view.element.querySelector(".hero-counter b");
    if (counter) counter.textContent = String(target + 1).padStart(2, "0");
    bindHeroControls();
    warmNeighbours(view);
    const reduced = root.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!previous || reduced || typeof next.animate !== "function") {
      previous?.remove(); busy(view, false); return true;
    }
    previous.setAttribute("aria-hidden", "true"); previous.inert = true;
    const offset = view.element.getBoundingClientRect().width * (direction < 0 ? -1 : 1);
    const options = { duration:620, easing:"cubic-bezier(.22,.72,.22,1)", fill:"both" };
    const outgoing = [...previous.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    const incoming = [...next.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    view.animations = [
      ...outgoing.map(element => element.animate([{ transform:"translateX(0px)" }, { transform:`translateX(${-offset}px)` }], options)),
      ...incoming.map(element => element.animate([{ transform:`translateX(${offset}px)` }, { transform:"translateX(0px)" }], options))
    ];
    view.transition = Promise.allSettled(view.animations.map(animation => animation.finished)).then(() => {
      previous.remove();
      view.animations.forEach(animation => animation.cancel()); view.animations = [];
      if (valid(view) && ticket === view.ticket) busy(view, false);
    });
    await view.transition;
    return valid(view);
  }
  function move(direction = 1, { automatic = false } = {}) {
    const view = active;
    if (!view || !valid(view) || view.pool.length < 2 || automatic && (view.loading || document.hidden)) return Promise.resolve(false);
    return select((view.loading ? view.target : view.index) + direction, direction);
  }
  function mount() {
    cancel();
    const element = document.querySelector("#featured");
    if (!element || state.route !== "home" || !state.featured) return;
    const pool = state.featuredPool.length ? state.featuredPool : [state.featured];
    // Keep the arrows and grading stationary; artwork and its copy move as one horizontal slide.
    element.classList.remove("hero-refresh"); element.classList.add("spotlight-ready");
    element.innerHTML = `<div class="home-hero-grade" aria-hidden="true"></div><div class="home-hero-shade"></div><div class="spotlight-placeholder" role="status" aria-label="Loading spotlight artwork"></div>${heroNavigation()}`;
    active = { element, pool:state.featuredPool, scope:scope(), index:state.featuredIndex || 0, target:state.featuredIndex || 0, ticket:0, current:null, animations:[], transition:Promise.resolve(), loading:false };
    // A one-title fallback is also decoded before its copy is inserted.
    if (!state.featuredPool.length) { active.pool = state.featuredPool = pool; active.index = active.target = 0; }
    bindHeroControls();
    void select(active.index);
    warmNeighbours(active);
  }
  return { createImageLoader, mount, cancel, preload, select, move };
});
