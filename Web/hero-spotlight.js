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
  function chooseTextlessPoster(posters, regularPosterPath) {
    if (!Array.isArray(posters) || !regularPosterPath) return null;
    const regular = posters.find(image => image?.file_path === regularPosterPath && Number(image.width) > 0 && Number(image.height) > 0);
    // TMDB may return only null-language images for include_image_language=null,
    // so fall back to the catalog's standard 2:3 poster ratio when needed.
    const ratio = regular ? Number(regular.width) / Number(regular.height) : 2 / 3;
    return posters
      .filter(image => image?.iso_639_1 == null && typeof image.file_path === "string" && image.file_path.startsWith("/") && Number(image.width) > 0 && Number(image.height) > 0)
      .filter(image => Math.abs(Number(image.width) / Number(image.height) - ratio) <= 0.01)
      .sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0) || (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0))[0]?.file_path || null;
  }
  function createTextlessPosterLoader({ fetchImpl = (...args) => root.fetch(...args), timeout = 9000 } = {}) {
    const entries = new Map();
    function load(item) {
      const type = item?.type === "tv" || item?.media_type === "tv" || item?.first_air_date ? "tv" : "movie";
      const id = Number(item?.id), posterPath = item?.poster_path || item?.posterPath;
      if (!Number.isSafeInteger(id) || id < 1 || typeof posterPath !== "string" || !posterPath.startsWith("/")) return Promise.resolve(null);
      const key = `${type}:${id}`;
      if (entries.has(key)) return entries.get(key);
      const pending = (async () => {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetchImpl(`/api/tmdb/${type}/${id}/images?include_image_language=null`, { signal:controller.signal, credentials:"same-origin" });
          if (!response?.ok) return null;
          const images = await response.json();
          return chooseTextlessPoster(images?.posters, posterPath);
        } catch { return null; }
        finally { clearTimeout(timer); }
      })();
      entries.set(key, pending);
      return pending;
    }
    return { load };
  }
  const loader = createImageLoader();
  const textlessPosterLoader = createTextlessPosterLoader();
  const TRANSITION_DURATION = 620;
  const TRANSITION_EASING = "cubic-bezier(.22,.72,.22,1)";
  let active = null;
  const artwork = item => [item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : "", posterOf(item), STILL_FALLBACK];
  const phoneArtwork = item => {
    const posterPath = item.poster_path || item.posterPath;
    return root.matchMedia?.("(max-width: 767px)").matches && posterPath
      ? [`${TMDB_IMAGE.replace(/\/w\d+$/, "/w780")}${posterPath}`, ...artwork(item)]
      : artwork(item);
  };
  function valid(view) { return active === view && document.querySelector("#featured") === view.element; }
  function syncPhoneTitleFade(slide) {
    const view = active;
    if (!view || view.current !== slide || !root.matchMedia?.("(max-width: 767px)").matches) return;
    view.element.style.setProperty("--phone-hero-title-fade-start", slide.classList.contains("phone-poster-textless-loaded") || slide.classList.contains("phone-poster-textless-already") ? "40%" : "35%");
  }
  function installTextlessPoster(slide, item) {
    if (!root.matchMedia?.("(max-width: 767px)").matches) return;
    const picture = slide.querySelector(".home-hero-phone-art"), regular = picture?.querySelector("img");
    if (!regular) { slide.classList.add("phone-poster-no-textless"); return; }
    const currentPosterPath = item.poster_path || item.posterPath;
    const image = document.createElement("img");
    image.className = "home-hero-textless-poster";
    image.alt = ""; image.setAttribute("aria-hidden", "true"); image.loading = "eager"; image.decoding = "async";
    let status = "pending", decoded = false;
    const deadline = performance.now() + 1500;
    let timer;
    const fail = () => {
      if (status !== "pending") return;
      status = "failed"; clearTimeout(timer); image.remove(); slide.classList.add("phone-poster-no-textless"); syncPhoneTitleFade(slide);
    };
    const reveal = () => {
      if (status !== "pending") return;
      if (performance.now() >= deadline) { fail(); return; }
      if (!decoded || !slide.classList.contains("phone-poster-loaded")) return;
      status = "loaded"; clearTimeout(timer); slide.classList.add("phone-poster-textless-loaded"); syncPhoneTitleFade(slide);
    };
    image.addEventListener("load", async () => {
      try { if (typeof image.decode === "function") await image.decode(); } catch { /* A loaded image can still be painted if decode() is unsupported. */ }
      if (!image.naturalWidth) { fail(); return; }
      decoded = true; reveal();
    }, { once:true });
    regular.addEventListener("load", reveal);
    picture.after(image);
    timer = setTimeout(fail, Math.max(0, deadline - performance.now()));
    void textlessPosterLoader.load(item).then(path => {
      if (!path) { fail(); return; }
      if (status !== "pending" || performance.now() >= deadline) { fail(); return; }
      if (path === currentPosterPath) {
        status = "loaded"; clearTimeout(timer); slide.classList.add("phone-poster-textless-already"); syncPhoneTitleFade(slide); return;
      }
      image.src = `${TMDB_IMAGE.replace(/\/w\d+$/, "/w780")}${path}`;
    }).catch(fail);
  }
  function warmTextlessPoster(item) {
    if (root.matchMedia?.("(max-width: 767px)").matches) void textlessPosterLoader.load(item);
  }
  function preload(pool = []) {
    // Keep the decoded working set small; do not decode a dozen full-size backdrops on phones.
    pool.slice(0, 2).forEach(item => { void loader.first(phoneArtwork(item)).catch(() => {}); warmTextlessPoster(item); });
  }
  function warmNeighbours(view) {
    if (!valid(view) || view.pool.length < 2) return;
    const next = view.pool[(view.index + 1) % view.pool.length];
    void loader.first(phoneArtwork(next)).catch(() => {});
    warmTextlessPoster(next);
  }
  function cancel() {
    if (!active) return;
    const view = active; active = null; view.ticket++;
    view.animations.forEach(animation => animation.cancel());
    view.queue.length = 0;
    view.element.removeAttribute("aria-busy");
  }
  function panel(item, url = STILL_FALLBACK) {
    const template = document.createElement("template");
    template.innerHTML = featuredMarkup(item);
    const slide = document.createElement("div");
    slide.className = "spotlight-slide"; slide.dataset.spotlightTitle = `${contentType(item)}:${item.id}`;
    const backdrop = template.content.querySelector(".home-hero-backdrop");
    backdrop.style.backgroundImage = `url(${JSON.stringify(url)}), url(${JSON.stringify(STILL_FALLBACK)})`;
    const phonePoster = template.content.querySelector(".home-hero-phone-art img");
    if (phonePoster) {
      slide.classList.add("has-phone-poster");
      // This is the visible hero image, so don't leave it to native lazy loading
      // after the old slide starts moving away.
      phonePoster.loading = "eager";
      phonePoster.fetchPriority = "high";
      const revealPoster = () => {
        if (root.matchMedia?.("(max-width: 767px)").matches && phonePoster.complete && phonePoster.naturalWidth > 1) slide.classList.add("phone-poster-loaded");
      };
      const failPoster = () => slide.classList.add("phone-poster-failed");
      phonePoster.addEventListener("load", revealPoster);
      phonePoster.addEventListener("error", failPoster);
      revealPoster();
    }
    slide.append(backdrop, template.content.querySelector(".home-hero-layout"));
    installTextlessPoster(slide, item);
    return slide;
  }
  function busy(view, value) {
    if (!valid(view)) return;
    view.loading = value;
    if (value) view.element.setAttribute("aria-busy", "true"); else view.element.removeAttribute("aria-busy");
  }
  function cssSlideFallback(outgoing, incoming, offset) {
    const entries = [...outgoing.map(element => [element, -offset]), ...incoming.map(element => [element, 0])];
    const saved = entries.map(([element]) => [element, element.style.transition, element.style.transform, element.style.willChange]);
    const frame = callback => root.requestAnimationFrame
      ? root.requestAnimationFrame.call(root, callback)
      : setTimeout(callback, 16);
    entries.forEach(([element, destination], index) => {
      element.style.transition = "none";
      element.style.transform = index < outgoing.length ? "translateX(0px)" : `translateX(${offset}px)`;
      element.style.willChange = "transform";
    });
    // Commit the start positions before asking CSS to animate to the other side.
    void incoming[0]?.getBoundingClientRect();
    return new Promise(resolve => frame(() => {
      entries.forEach(([element, destination]) => {
        element.style.transition = `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`;
        element.style.transform = `translateX(${destination}px)`;
      });
      setTimeout(() => {
        saved.forEach(([element, transition, transform, willChange]) => {
          element.style.transition = transition;
          element.style.transform = transform;
          element.style.willChange = willChange;
        });
        resolve();
      }, TRANSITION_DURATION + 50);
    }));
  }
  function updateHeroControls(view) {
    if (!valid(view)) return;
    view.element.querySelectorAll("[data-hero-index]").forEach(button => {
      const activeIndex = Number(button.dataset.heroIndex) === view.index;
      button.classList.toggle("is-active", activeIndex);
      if (activeIndex) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
    });
    const live = view.element.querySelector("[data-hero-slide-live]");
    if (live) live.textContent = `Slide ${view.index + 1} of ${view.pool.length}`;
  }
  function bindHeroControls(view) {
    if (!valid(view) || view.controlsBound) return;
    view.controlsBound = true;
    view.element.addEventListener("click", event => {
      if (active !== view || !valid(view)) return;
      const control = event.target.closest?.("[data-hero-direction], [data-hero-index], .home-hero-content [data-open]");
      if (!control || !view.element.contains(control)) return;
      event.preventDefault();
      if (control.hasAttribute("data-hero-direction")) {
        const direction = Number(control.dataset.heroDirection);
        void move(direction);
        view.element.querySelector(`[data-hero-direction="${direction}"]`)?.focus({ preventScroll:true });
        return;
      }
      if (control.hasAttribute("data-hero-index")) {
        void select(Number(control.dataset.heroIndex));
        return;
      }
      const [type, id] = control.dataset.open.split(":");
      openItem(type, Number(id));
    });
    updateHeroControls(view);
  }
  async function transitionTo(view, target, direction) {
    if (!valid(view)) return;
    const ticket = ++view.ticket;
    const item = view.pool[target], previous = view.current, next = panel(item);
    view.element.querySelectorAll(".spotlight-slide").forEach(slide => { if (slide !== previous) slide.remove(); });
    view.element.append(next);
    view.current = next; view.index = target; view.target = target;
    state.featuredIndex = target; state.featured = item;
    syncPhoneTitleFade(next);
    view.element.querySelector(".spotlight-placeholder")?.remove();
    updateHeroControls(view);
    warmNeighbours(view);

    const backdrop = next.querySelector(".home-hero-backdrop");
    void loader.first(phoneArtwork(item)).then(ready => {
      if (!valid(view) || ticket !== view.ticket || view.current !== next || !backdrop) return;
      backdrop.style.backgroundImage = `url(${JSON.stringify(ready.url)}), url(${JSON.stringify(STILL_FALLBACK)})`;
    }).catch(() => {});

    const reduced = root.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!previous || reduced) {
      previous?.remove();
      return;
    }
    previous.setAttribute("aria-hidden", "true"); previous.inert = true;
    const offset = view.element.getBoundingClientRect().width * (direction < 0 ? -1 : 1);
    const options = { duration:TRANSITION_DURATION, easing:TRANSITION_EASING, fill:"both" };
    const outgoing = [...previous.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    const incoming = [...next.querySelectorAll(".home-hero-backdrop, .home-hero-layout")];
    let animations = [];
    try {
      if (typeof next.animate !== "function") throw new Error("Web Animations API unavailable");
      animations = [
        ...outgoing.map(element => element.animate([{ transform:"translateX(0px)" }, { transform:`translateX(${-offset}px)` }], options)),
        ...incoming.map(element => element.animate([{ transform:`translateX(${offset}px)` }, { transform:"translateX(0px)" }], options))
      ];
    } catch {
      animations.forEach(animation => animation.cancel());
      animations = [];
    }
    if (animations.length) {
      view.animations = animations;
      let safetyTimer;
      await Promise.race([
        Promise.allSettled(animations.map(animation => animation.finished)),
        new Promise(resolve => { safetyTimer = setTimeout(resolve, 900); })
      ]);
      clearTimeout(safetyTimer);
    } else await cssSlideFallback(outgoing, incoming, offset);
    if (!valid(view) || ticket !== view.ticket) return;
    previous.remove();
    animations.forEach(animation => animation.cancel());
    if (view.animations === animations) view.animations = [];
  }
  async function drain(view) {
    let changed = false;
    while (valid(view) && view.queue.length) {
      const { target, direction } = view.queue.shift();
      if (target === view.index && view.current) continue;
      try { await transitionTo(view, target, direction); changed = true; }
      catch { /* Keep navigation available if a browser rejects an animation operation. */ }
    }
    if (valid(view)) busy(view, false);
    view.running = false;
    return changed;
  }
  function select(index, direction = 1) {
    const view = active;
    if (!view || !valid(view) || !view.pool.length) return Promise.resolve(false);
    const count = view.pool.length, target = ((index % count) + count) % count;
    const queuedTarget = view.queue.length ? view.queue[view.queue.length - 1].target : view.index;
    if (target === queuedTarget && view.current) return Promise.resolve(false);
    view.queue.push({ target, direction });
    view.target = target;
    busy(view, true);
    if (view.running) return view.navigation || Promise.resolve(true);
    view.running = true;
    view.navigation = drain(view);
    return view.navigation;
  }
  function move(direction = 1, { automatic = false } = {}) {
    const view = active;
    if (!view || !valid(view) || view.pool.length < 2 || automatic && (view.loading || document.hidden)) return Promise.resolve(false);
    const current = view.queue.length ? view.queue[view.queue.length - 1].target : view.index;
    return select(current + direction, direction);
  }
  function mount() {
    cancel();
    const element = document.querySelector("#featured");
    if (!element || state.route !== "home" || !state.featured) return;
    const pool = state.featuredPool.length ? state.featuredPool : [state.featured];
    // Keep the arrows and grading stationary; artwork and its copy move as one horizontal slide.
    element.classList.remove("hero-refresh"); element.classList.add("spotlight-ready");
    element.innerHTML = `<div class="home-hero-grade" aria-hidden="true"></div><div class="home-hero-shade"></div><div class="spotlight-placeholder" role="status" aria-label="Loading spotlight artwork"></div>${heroNavigation()}`;
    active = { element, pool:state.featuredPool, index:state.featuredIndex || 0, target:state.featuredIndex || 0, ticket:0, current:null, animations:[], loading:false, queue:[], running:false, navigation:null, controlsBound:false };
    // A one-title fallback is also decoded before its copy is inserted.
    if (!state.featuredPool.length) { active.pool = state.featuredPool = pool; active.index = active.target = 0; }
    bindHeroControls(active);
    void select(active.index);
    warmNeighbours(active);
  }
  return { createImageLoader, createTextlessPosterLoader, chooseTextlessPoster, mount, cancel, preload, select, move };
});
