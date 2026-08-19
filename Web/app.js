const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const FEATURED_ID = 71712;
const app = document.querySelector("#app");
const state = { featured: null, catalog: {}, route: "home", search: "" };
const watchKey = item => `cineva-progress-${item.type}-${item.id}-${item.season || 0}-${item.episode || 0}`;
const titleOf = item => item.title || item.name || item.original_title || item.original_name || "Untitled";
const yearOf = item => (item.release_date || item.first_air_date || "").slice(0, 4);
const posterOf = item => item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : "/icon.svg";
const escapeHTML = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);

async function api(path, params = {}) {
  const query = new URLSearchParams(params); const response = await fetch(`/api/tmdb/${path}${query.size ? `?${query}` : ""}`);
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "TMDB is not configured");
  return response.json();
}
async function boot() {
  renderLoading();
  try {
    const [featured, trending, movies, shows, recent] = await Promise.all([
      api(`tv/${FEATURED_ID}`), api("trending/all/week"), api("movie/popular"), api("tv/popular"), api("movie/now_playing")
    ]);
    state.featured = normalize(featured, "tv");
    state.catalog = { "Trending now": results(trending), "Popular movies": results(movies), "Popular series": results(shows), "Newly added": results(recent) };
  } catch (error) {
    state.featured = { id: FEATURED_ID, type: "tv", name: "The Good Doctor", overview: "Add a TMDB Read Access Token to enable posters, descriptions, categories, and search.", backdrop_path: null };
    state.catalog = {};
    state.error = error.message;
  }
  render();
}
function results(payload) { return (payload.results || []).filter(item => item.media_type !== "person").map(item => normalize(item)); }
function normalize(item, fallbackType) { return { ...item, type: item.type || (item.media_type === "movie" || item.title ? "movie" : fallbackType || "tv") }; }
function header() { return `<header><button class="wordmark" data-home aria-label="Cineva home">CINEVA</button><nav><button class="nav-link" data-home>Home</button><button class="nav-link" data-search-focus>Search</button></nav><label class="search"><span>⌕</span><input id="search" value="${escapeHTML(state.search)}" placeholder="Titles, movies, series" autocomplete="off"></label></header>`; }
function render() { if (state.route === "player") return renderPlayer(); if (state.route === "series") return renderSeries(); if (state.route === "search") return renderSearch(); renderHome(); }
function renderLoading() { app.innerHTML = `<header><span class="wordmark">CINEVA</span></header><section class="hero skeleton"></section><section class="rail"><div class="skeleton-line wide"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section><section class="rail"><div class="skeleton-line"></div><div class="cards">${Array.from({length:7}, () => `<div class="card-skeleton skeleton"></div>`).join("")}</div></section>`; }
function renderHome() {
  const f = state.featured;
  app.innerHTML = `${header()}<section class="hero" style="${f.backdrop_path ? `background-image:linear-gradient(90deg,#050505 5%,#050505bb 48%,#0505053d 100%),url(${TMDB_IMAGE}${f.backdrop_path})` : ""}"><div class="hero-copy"><span class="brand">CINEVA PRESENTS</span><h1>${escapeHTML(titleOf(f))}</h1><div class="meta"><span>${yearOf(f) || "2017"}</span><i></i><span>${f.vote_average ? `★ ${f.vote_average.toFixed(1)}` : "TV-14"}</span><i></i><span>${f.type === "tv" ? "Series" : "Movie"}</span></div><p>${escapeHTML(f.overview || "")}</p><div class="actions"><button class="primary" data-open="${f.type}:${f.id}"><b>▶</b> Play</button><button class="secondary" data-open="${f.type}:${f.id}"><b>ⓘ</b> More info</button></div></div></section>${state.error ? `<p class="setup">TMDB setup needed: ${escapeHTML(state.error)}. See README.</p>` : ""}<div id="rails">${Object.entries(state.catalog).map(([name, items]) => rail(name, items)).join("")}</div>`;
  bindCommon();
}
function rail(name, items) { return `<section class="rail"><div class="rail-title"><h2>${name}</h2><span>Explore all</span></div><div class="cards">${items.map(card).join("")}</div></section>`; }
function card(item) { return `<button class="card" data-open="${item.type}:${item.id}"><span class="poster-wrap"><img src="${posterOf(item)}" alt="" loading="lazy"><i>${item.type === "tv" ? "SERIES" : "MOVIE"}</i></span><b>${escapeHTML(titleOf(item))}</b><small>${yearOf(item) || "New"}${item.vote_average ? ` · ★ ${item.vote_average.toFixed(1)}` : ""}</small></button>`; }
async function openItem(type, id) {
  try {
    const item = normalize(await api(`${type}/${id}`), type);
    if (type === "movie") { state.player = { type, id: item.id, title: titleOf(item), overview: item.overview }; state.route = "player"; }
    else { state.series = item; state.selectedSeason = 1; state.route = "series"; await loadEpisodes(); }
  } catch (error) { state.error = error.message; state.route = "home"; }
  render();
}
async function loadEpisodes() { state.episodes = await api(`tv/${state.series.id}/season/${state.selectedSeason}`); }
function renderSeries() {
  const s = state.series, seasons = (s.seasons || []).filter(x => x.season_number > 0);
  app.innerHTML = `${header()}<button class="back" data-home>‹ Browse</button><section class="detail"><img src="${posterOf(s)}" alt="${escapeHTML(titleOf(s))}"><div><span class="brand">SERIES</span><h1>${escapeHTML(titleOf(s))}</h1><div class="meta"><span>${yearOf(s)}</span><i></i><span>${s.number_of_seasons || seasons.length} seasons</span><i></i><span>${s.vote_average ? `★ ${s.vote_average.toFixed(1)}` : "TV-14"}</span></div><p>${escapeHTML(s.overview || "")}</p><button class="primary" data-play-series><b>▶</b> Play season ${state.selectedSeason}</button></div></section><section class="episode-section"><div class="rail-title"><h2>Episodes</h2><span>Season ${state.selectedSeason}</span></div><div class="season-row">${seasons.map(x => `<button class="season ${x.season_number === state.selectedSeason ? "active" : ""}" data-season="${x.season_number}">Season ${x.season_number}</button>`).join("")}</div><div id="episodes-list">${(state.episodes?.episodes || []).map(episode => `<button class="episode" data-play-episode="${episode.episode_number}"><img src="${episode.still_path ? TMDB_IMAGE + episode.still_path : "/icon.svg"}" alt=""><span><b><em>${String(episode.episode_number).padStart(2,"0")}</em>${escapeHTML(episode.name)}</b><small>${escapeHTML(episode.overview || "No description available.")}</small></span><strong>›</strong></button>`).join("")}</div></section>`;
  bindCommon(); document.querySelectorAll("[data-season]").forEach(button => button.onclick = async () => { state.selectedSeason = Number(button.dataset.season); await loadEpisodes(); render(); });
  document.querySelector("[data-play-series]").onclick = () => playEpisode(1);
  document.querySelectorAll("[data-play-episode]").forEach(button => button.onclick = () => playEpisode(Number(button.dataset.playEpisode)));
}
function playEpisode(number) { const episode = (state.episodes.episodes || []).find(x => x.episode_number === number) || {}; state.player = { type:"tv", id:state.series.id, season:state.selectedSeason, episode:number, title:episode.name || titleOf(state.series), overview:episode.overview || state.series.overview }; state.route = "player"; render(); }
function playerURL(item) { const progress = JSON.parse(localStorage.getItem(watchKey(item)) || "{}").currentTime || 0; const base = item.type === "movie" ? `movie/${item.id}` : `tv/${item.id}/${item.season}/${item.episode}`; return `https://www.vidking.net/embed/${base}?${new URLSearchParams({color:"b20710",autoPlay:"true",nextEpisode:"true",episodeSelector:"true",progress:String(Math.floor(progress))})}`; }
function renderPlayer() { const p = state.player, saved = JSON.parse(localStorage.getItem(watchKey(p)) || "{}"); app.innerHTML = `${header()}<button class="back" data-back>‹ Back</button><iframe class="player" src="${playerURL(p)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><section class="now"><span class="brand">NOW PLAYING</span><h2>${escapeHTML(p.title)}</h2><div class="progress"><i id="bar" style="width:${saved.progress || 0}%"></i></div><p id="time">${saved.currentTime ? `Resume from ${Math.floor(saved.currentTime)} seconds` : escapeHTML(p.overview || "Playback progress is saved on this iPhone.")}</p></section>`; bindCommon(); document.querySelector("[data-back]").onclick = () => { state.route = p.type === "tv" ? "series" : "home"; render(); }; }
async function search(query) { state.search = query; if (query.trim().length < 2) { state.searchResults = []; state.route = "home"; render(); return; } try { state.searchResults = results(await api("search/multi", { query })); state.route = "search"; } catch (error) { state.error = error.message; state.route = "home"; } render(); }
function renderSearch() { app.innerHTML = `${header()}<section class="search-page"><span class="brand">DISCOVER</span><h2>Search results</h2>${state.searchResults.length ? `<div class="result-grid">${state.searchResults.map(card).join("")}</div>` : "<p>No matches found. Try a movie, series, or actor name.</p>"}</section>`; bindCommon(); }
function bindCommon() { document.querySelectorAll("[data-home]").forEach(button => button.onclick = () => { state.route = "home"; render(); }); document.querySelectorAll("[data-open]").forEach(button => button.onclick = () => { const [type, id] = button.dataset.open.split(":"); openItem(type, id); }); const input = document.querySelector("#search"); let timer; input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => search(input.value), 350); }; document.querySelectorAll("[data-search-focus]").forEach(button => button.onclick = () => input.focus()); }
window.addEventListener("message", event => { let payload; try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; } if (state.route !== "player" || payload?.type !== "PLAYER_EVENT") return; const data = payload.data || {}, duration = Number(data.duration) || 0, currentTime = Number(data.currentTime) || 0; if (!duration) return; const progress = Math.min(100, currentTime / duration * 100); localStorage.setItem(watchKey(state.player), JSON.stringify({currentTime,duration,progress})); const bar = document.querySelector("#bar"), time = document.querySelector("#time"); if (bar) bar.style.width = `${progress}%`; if (time) time.textContent = `${Math.floor(currentTime)}s of ${Math.floor(duration)}s`; });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js");
boot();
