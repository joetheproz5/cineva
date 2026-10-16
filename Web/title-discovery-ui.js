(function (root) {
  const model = () => root.SEVENTitleDiscovery;
  const cache = root.SEVENTitleDiscovery.createCache(async (path, params) => {
    let timer;
    try {
      const result = await Promise.race([api(path, params), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Metadata request timed out")), 15000); })]);
      if (path.startsWith("collection/") ? !Array.isArray(result?.parts) : !Array.isArray(result?.results)) throw new Error("Invalid discovery metadata");
      return result;
    } finally { clearTimeout(timer); }
  });
  let translated = false;
  function translations() {
    if (translated) return;
    translated = true;
    Object.assign(UI_STRINGS.French, { "This profile’s content settings hide the films in this collection.":"Les réglages de contenu de ce profil masquent les films de cette collection.", "Review profile settings":"Voir les réglages du profil" });
    Object.assign(UI_STRINGS.Arabic, { "This profile’s content settings hide the films in this collection.":"إعدادات المحتوى لهذا الملف تخفي أفلام هذه المجموعة.", "Review profile settings":"مراجعة إعدادات الملف" });
    Object.assign(UI_STRINGS.French, {
      "THE COLLECTION":"LA COLLECTION", "Movie collection":"Collection de films", "films":"films", "watched":"vus", "Explore collection":"Voir la collection", "Release order":"Ordre de sortie", "More like this":"Titres similaires", "Watched":"Vu", "Unwatched":"Non vus", "All":"Tous", "Current title":"Titre actuel", "Resume from":"Reprendre à", "Date to be announced":"Date à venir", "Unannounced":"Non annoncé", "Show more":"Afficher plus", "Loading…":"Chargement…", "Collection couldn’t load.":"Impossible de charger la collection.", "Related titles couldn’t load.":"Impossible de charger les titres similaires.", "Some suggestions couldn’t load.":"Certaines suggestions n’ont pas pu être chargées.", "No related titles yet.":"Aucun titre similaire pour le moment.", "suggestions shown":"suggestions affichées", "released films watched":"films sortis vus", "Collection progress":"Progression de la collection", "CONTINUE THE COLLECTION":"POURSUIVRE LA COLLECTION", "NEXT UNWATCHED":"PROCHAIN FILM NON VU", "View title":"Voir le titre", "You’re caught up.":"Vous êtes à jour.", "Filter collection":"Filtrer la collection", "Order":"Ordre", "Collection order":"Ordre de la collection", "Newest first":"Plus récents", "No watched films yet.":"Aucun film vu pour le moment.", "No films to show.":"Aucun film à afficher.", "Release dates from TMDB. Playback availability depends on your source.":"Dates de sortie fournies par TMDB. La disponibilité dépend de la source."
    });
    Object.assign(UI_STRINGS.Arabic, {
      "THE COLLECTION":"المجموعة", "Movie collection":"مجموعة أفلام", "films":"أفلام", "watched":"تمت مشاهدتها", "Explore collection":"استكشف المجموعة", "Release order":"ترتيب الإصدار", "More like this":"عناوين مشابهة", "Watched":"تمت المشاهدة", "Unwatched":"لم تُشاهد", "All":"الكل", "Current title":"العنوان الحالي", "Resume from":"استئناف من", "Date to be announced":"سيُعلن الموعد لاحقاً", "Unannounced":"غير معلن", "Show more":"عرض المزيد", "Loading…":"جارٍ التحميل…", "Collection couldn’t load.":"تعذّر تحميل المجموعة.", "Related titles couldn’t load.":"تعذّر تحميل العناوين المشابهة.", "Some suggestions couldn’t load.":"تعذّر تحميل بعض الاقتراحات.", "No related titles yet.":"لا توجد عناوين مشابهة حالياً.", "suggestions shown":"اقتراحات معروضة", "released films watched":"من الأفلام الصادرة تمت مشاهدتها", "Collection progress":"تقدم المجموعة", "CONTINUE THE COLLECTION":"تابع المجموعة", "NEXT UNWATCHED":"الفيلم التالي الذي لم تشاهده", "View title":"عرض العنوان", "You’re caught up.":"شاهدت جميع الأفلام الصادرة.", "Filter collection":"تصفية المجموعة", "Order":"الترتيب", "Collection order":"ترتيب المجموعة", "Newest first":"الأحدث أولاً", "No watched films yet.":"لم تشاهد أي فيلم بعد.", "No films to show.":"لا توجد أفلام لعرضها.", "Release dates from TMDB. Playback availability depends on your source.":"تواريخ الإصدار من TMDB. يعتمد توفر المشاهدة على المصدر."
    });
  }
  const scope = () => JSON.stringify([state.user?.id || "guest", activeProfileId(), currentPreferences().language]);
  const metadata = (path, params) => {
    const language = currentPreferences().language;
    return cache.get(path, { ...params, language:DISPLAY_LANGUAGES[language] || "en-US" }, language);
  };
  const allowed = item => contentAllowed(item);
  const readProgress = item => savedProgress(item);
  const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const image = (path, size = "w780") => typeof path === "string" && /^\/[a-zA-Z0-9_.\/-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : "";
  const dateLabel = item => {
    const date = model().dateOf(item);
    return date ? new Date(`${date}T12:00:00`).toLocaleDateString(DISPLAY_LANGUAGES[currentPreferences().language] || "en-US", { month:"short", day:"numeric", year:"numeric" }) : t("Date to be announced");
  };
  function detailItem() { return state.route === "movie" ? state.movie : state.route === "series" ? state.series : null; }
  function current(view) {
    const item = detailItem();
    return state.titleDiscovery === view && view.scope === scope() && item?.id === view.item.id && contentType(item) === view.item.type;
  }
  function visibleParts(collection) { return model().parts(collection, allowed); }
  function relatedItems(view) {
    return model().related(view.related.items, { type:view.item.type, id:view.item.id, collection:model().parts(view.collection), allowed });
  }
  function bind(container) {
    container.querySelectorAll("[data-discovery-settings]").forEach(button => button.onclick = () => showAccount());
    container.querySelectorAll("[data-open]").forEach(button => button.onclick = () => {
      const [type, id] = button.dataset.open.split(":"); void openItem(type, Number(id));
    });
    container.querySelectorAll("[data-toggle-watchlist]").forEach(button => button.onclick = event => {
      event.stopPropagation(); const item = state.watchlistTargets.get(button.dataset.toggleWatchlist); if (item) void toggleWatchlist(item);
    });
    container.querySelectorAll("[data-open-franchise]").forEach(button => button.onclick = () => void openFranchise(state.titleDiscovery));
  }
  function gridCard(item, { order = 0, selected = false } = {}) {
    const progress = model().progress(item, readProgress), released = model().released(item), date = model().dateOf(item);
    const status = released ? progress.watched ? t("Watched") : progress.resume ? `${t("Resume from")} ${timeLabel(progress.seconds | 0)}` : "" : date ? `${t("Releases")} ${dateLabel(item)}` : t("Date to be announced");
    return `<article class="discovery-card${selected ? " is-current" : ""}"><button type="button" class="discovery-card-open" data-open="${item.type}:${item.id}" aria-label="${escapeHTML(titleOf(item))}${selected ? ` · ${t("Current title")}` : ""}"><span class="discovery-poster"><img src="${image(item.poster_path, "w500") || POSTER_FALLBACK}" alt="" loading="lazy" decoding="async">${progress.watched && released ? `<span class="discovery-watched" aria-label="${t("Watched")}">${check}</span>` : ""}${selected ? `<span class="discovery-current">${t("Current title")}</span>` : ""}${released && !progress.watched && progress.percent > 0 ? `<span class="discovery-progress"><i style="width:${progress.percent}%"></i></span>` : ""}</span><span class="discovery-card-copy">${order ? `<span class="discovery-order">${String(order).padStart(2, "0")}</span>` : ""}<span><b>${escapeHTML(titleOf(item))}</b><small>${date ? date.slice(0, 4) : t("Unannounced")}${item.type === "tv" ? ` · ${t("Series")}` : ""}</small>${status ? `<em>${escapeHTML(status)}</em>` : ""}</span></span></button>${watchlistAction(item, "card")}</article>`;
  }
  function skeleton() { return `<div class="discovery-skeletons" aria-hidden="true">${Array.from({ length:6 }, () => '<span class="skeleton"></span>').join("")}</div>`; }
  function preview(view) {
    if (view.collectionLoading) return '<div class="franchise-preview-loading skeleton" aria-label="Loading collection"></div>';
    if (view.collectionError) return `<div class="discovery-notice"><span>${t("Collection couldn’t load.")}</span><button type="button" data-retry-collection>${t("Try again")}</button></div>`;
    const allParts = model().parts(view.collection), parts = visibleParts(view.collection);
    if (allParts.length < 2) return "";
    if (!parts.length) return `<div class="franchise-unavailable"><small>${t("THE COLLECTION")}</small><strong>${escapeHTML(view.collection.name || t("Movie collection"))}</strong><p>${t("This profile’s content settings hide the films in this collection.")}</p>${state.user ? `<button type="button" data-discovery-settings>${t("Review profile settings")} ${chevron}</button>` : ""}</div>`;
    const summary = model().summary(parts, readProgress), covers = parts.filter(item => image(item.poster_path)).slice(0, 3);
    const art = image(view.collection.backdrop_path), years = parts.map(model().dateOf).filter(Boolean).map(date => date.slice(0, 4));
    return `<button type="button" class="franchise-preview" data-open-franchise${art ? ` style="--franchise-art:url('${art}')"` : ""}><span class="franchise-preview-copy"><small>${t("THE COLLECTION")}</small><strong>${escapeHTML(view.collection.name || t("Movie collection"))}</strong><span>${parts.length} ${t("films")}${years.length ? ` <i>·</i> ${years[0]}${years.at(-1) !== years[0] ? `–${years.at(-1)}` : ""}` : ""}${state.session && summary.released ? ` <i>·</i> ${summary.watched}/${summary.released} ${t("watched")}` : ""}</span><em>${t("Explore collection")} ${chevron}</em></span><span class="franchise-preview-posters" aria-hidden="true">${covers.map(item => `<img src="${image(item.poster_path, "w342")}" alt="" loading="lazy">`).join("")}</span></button>`;
  }
  function paintPreview(view) {
    if (!current(view)) return;
    const host = document.querySelector("[data-franchise-preview]"); if (!host) return;
    host.innerHTML = preview(view); host.hidden = !host.innerHTML;
    host.querySelector("[data-retry-collection]")?.addEventListener("click", () => void loadCollection(view)); bind(host);
  }
  function paintRelated(view, focusIndex = -1) {
    if (!current(view)) return;
    const host = document.querySelector("[data-related-titles]"); if (!host) return;
    const items = relatedItems(view), more = items.length > view.visible || view.related.sources.some(source => !source.done);
    const waiting = view.collectionLoading || !items.length && view.loading;
    host.innerHTML = `<div class="discovery-heading"><h2>${t("More like this")}</h2></div>${waiting ? skeleton() : items.length ? `<div class="discovery-grid">${items.slice(0, view.visible).map(item => gridCard(item)).join("")}</div>` : `<p class="discovery-empty">${view.related.errors.length ? t("Related titles couldn’t load.") : t("No related titles yet.")}</p>`}<div class="discovery-more">${view.related.errors.length ? `<span role="status">${t("Some suggestions couldn’t load.")}</span>` : ""}${more || view.related.errors.length ? `<button type="button" data-more-related ${view.loading || waiting ? 'disabled aria-busy="true"' : ""}>${t(view.loading || waiting ? "Loading…" : view.related.errors.length ? "Try again" : "Show more")}</button>` : ""}</div><span class="discovery-sr" aria-live="polite">${items.length && !view.loading ? `${Math.min(view.visible, items.length)} ${t("suggestions shown")}` : ""}</span>`;
    bind(host);
    host.querySelector("[data-more-related]")?.addEventListener("click", () => {
      const index = Math.min(view.visible, relatedItems(view).length);
      if (!view.related.errors.length) view.visible += 6;
      void fillRelated(view, index);
    });
    if (focusIndex >= 0) host.querySelectorAll(".discovery-card-open")[focusIndex]?.focus({ preventScroll:true });
  }
  async function loadCollection(view) {
    if (!view.item.belongs_to_collection?.id || view.collectionLoading) return;
    view.collectionLoading = true; view.collectionError = false; paintPreview(view);
    try {
      const result = await metadata(`collection/${Number(view.item.belongs_to_collection.id)}`);
      if (!Array.isArray(result?.parts)) throw new Error("Invalid collection");
      view.collection = result;
    } catch { view.collectionError = true; }
    finally { view.collectionLoading = false; paintPreview(view); paintRelated(view); }
  }
  async function fillRelated(view, focusIndex = -1) {
    if (view.loading) return;
    view.loading = true; paintRelated(view);
    try {
      let scans = 0;
      while (relatedItems(view).length < view.visible && view.related.sources.some(source => !source.done) && scans++ < 3) {
        await model().loadRelated(view.related, metadata);
        if (view.related.errors.length || !current(view)) break;
      }
    } finally { view.loading = false; paintRelated(view, focusIndex); }
  }
  function mount() {
    const item = detailItem(); if (!item || !root.SEVENTitleDiscovery) return;
    translations();
    const key = `${contentType(item)}:${Number(item.id)}`, old = state.titleDiscovery;
    const view = old?.key === key && old.scope === scope() ? old : state.titleDiscovery = {
      key, scope:scope(), item:{ ...item, type:contentType(item) }, collection:null, collectionError:false, collectionLoading:false,
      related:model().createRelated(contentType(item), item.id), visible:6, loading:false, started:false
    };
    let host = document.querySelector("[data-title-discovery]");
    if (!host) {
      host = document.createElement("div"); host.className = "title-discovery"; host.dataset.titleDiscovery = "";
      host.innerHTML = `<section data-franchise-preview hidden></section><section class="related-titles" data-related-titles aria-label="${t("More like this")}"></section>`;
      const about = document.querySelector(".media-info");
      if (about) about.before(host); else document.querySelector(".detail, .series-shell")?.after(host);
    }
    paintPreview(view); paintRelated(view);
    if (!view.started) { view.started = true; void loadCollection(view); void fillRelated(view); }
  }
  async function openFranchise(discovery) {
    if (!discovery || discovery.scope !== scope() || !visibleParts(discovery.collection).length) return;
    state.franchise = { collection:discovery.collection, scope:scope(), source:discovery.item, filter:"all", reverse:false, limit:20 };
    state.route = "franchise"; render(); scrollToTop();
  }
  function renderFranchise() {
    translations();
    const view = state.franchise;
    if (!view || view.scope !== scope()) { state.route = "home"; render(); return; }
    const collection = view.collection, parts = visibleParts(collection), summary = model().summary(parts, readProgress);
    const ordered = model().order(parts, view.reverse);
    const shown = ordered.filter(item => view.filter === "all" || view.filter === "watched" && model().progress(item, readProgress).watched || view.filter === "unwatched" && !model().progress(item, readProgress).watched);
    const art = image(collection.backdrop_path, "original"), next = summary.next, nextProgress = next && model().progress(next, readProgress);
    const cards = shown.slice(0, view.limit || 20).map(item => gridCard(item, { order:parts.indexOf(item) + 1, selected:item.id === view.source.id })).join("");
    app.innerHTML = `${header()}<main class="franchise-page"><section class="franchise-hero"${art ? ` style="--franchise-art:url('${art}')"` : ""}><div class="franchise-hero-art" aria-hidden="true"></div><div class="franchise-hero-content"><button type="button" class="franchise-back" data-franchise-back>‹ ${t("Back")}</button><span class="franchise-eyebrow">${t("THE COLLECTION")}</span><h1>${escapeHTML(collection.name || t("Movie collection"))}</h1><p class="franchise-meta">${parts.length} ${t("films")} <i>·</i> ${t("Release order")}</p>${collection.overview ? `<p class="franchise-description">${escapeHTML(collection.overview)}</p>` : ""}${summary.released ? `<div class="franchise-progress-summary"><span>${summary.watched}/${summary.released} ${t("released films watched")}</span><span class="franchise-progress-track" role="progressbar" aria-label="${t("Collection progress")}" aria-valuemin="0" aria-valuemax="${summary.released}" aria-valuenow="${summary.watched}"><i style="width:${summary.watched / summary.released * 100}%"></i></span></div>` : ""}</div></section><div class="franchise-body">${next ? `<button type="button" class="franchise-next" data-open="movie:${next.id}"><img src="${image(next.poster_path, "w185") || POSTER_FALLBACK}" alt=""><span><small>${t(nextProgress.resume ? "CONTINUE THE COLLECTION" : "NEXT UNWATCHED")}</small><strong>${escapeHTML(titleOf(next))}</strong><em>${nextProgress.resume ? `${t("Resume from")} ${timeLabel(nextProgress.seconds | 0)}` : `${model().dateOf(next).slice(0, 4)} · ${t("View title")}`}</em></span>${chevron}</button>` : summary.complete ? `<p class="franchise-complete">${check}<span>${t("You’re caught up.")}</span></p>` : ""}<div class="franchise-toolbar"><div class="franchise-filters" role="group" aria-label="${t("Filter collection")}">${[["all","All"],["unwatched","Unwatched"],["watched","Watched"]].map(([value,label]) => `<button type="button" data-franchise-filter="${value}" aria-pressed="${view.filter === value}">${t(label)}</button>`).join("")}</div><label>${t("Order")}<select data-franchise-order aria-label="${t("Collection order")}"><option value="release" ${!view.reverse ? "selected" : ""}>${t("Release order")}</option><option value="newest" ${view.reverse ? "selected" : ""}>${t("Newest first")}</option></select></label></div><div data-franchise-results>${cards ? `<div class="discovery-grid franchise-grid">${cards}</div>` : `<p class="discovery-empty">${t(view.filter === "watched" ? "No watched films yet." : "No films to show.")}</p>`}${shown.length > (view.limit || 20) ? `<div class="discovery-more"><button type="button" data-more-franchise>${t("Show more")}</button></div>` : ""}</div><p class="franchise-footnote">${t("Release dates from TMDB. Playback availability depends on your source.")}</p></div></main>${footer()}`;
    bindCommon(); bind(app);
    document.querySelector("[data-franchise-back]").onclick = () => navigateBackInApp(() => void openItem(view.source.type, view.source.id));
    document.querySelectorAll("[data-franchise-filter]").forEach(button => button.onclick = () => {
      view.filter = button.dataset.franchiseFilter; view.limit = 20; const y = window.scrollY; render(); window.scrollTo(0, y);
      document.querySelector(`[data-franchise-filter="${view.filter}"]`)?.focus({ preventScroll:true });
    });
    document.querySelector("[data-franchise-order]").onchange = event => {
      view.reverse = event.target.value === "newest"; view.limit = 20; const y = window.scrollY; render(); window.scrollTo(0, y);
      document.querySelector("[data-franchise-order]")?.focus({ preventScroll:true });
    };
    document.querySelector("[data-more-franchise]")?.addEventListener("click", () => {
      const index = view.limit || 20, y = window.scrollY; view.limit = index + 20; render(); window.scrollTo(0, y);
      document.querySelectorAll(".franchise-grid .discovery-card-open")[index]?.focus({ preventScroll:true });
    });
  }
  root.SEVENDiscoveryUI = { mount, renderFranchise };
})(typeof window === "undefined" ? globalThis : window);
