const SERIES_ID = "71712";
const SERIES = "The Good Doctor";
const names = ["Burnt Food", "Mount Rushmore", "Oliver", "Pipes", "Point Three Percent", "Not Fake"];
const app = document.querySelector("#app");
let season = 1;
let selected = null;
const key = episode => `cineva-progress-${episode.season}-${episode.number}`;
const episodeFor = number => ({ season, number, title: names[number - 1] || `Episode ${number}` });
const episodeList = () => Array.from({ length: season === 1 ? 6 : 2 }, (_, i) => episodeFor(i + 1));

function embedURL(episode) {
  const progress = JSON.parse(localStorage.getItem(key(episode)) || "{}").currentTime || 0;
  const params = new URLSearchParams({ color:"d1ff47", autoPlay:"true", nextEpisode:"true", episodeSelector:"true", progress:String(Math.floor(progress)) });
  return `https://www.vidking.net/embed/tv/${SERIES_ID}/${episode.season}/${episode.number}?${params}`;
}
function renderCatalog() {
  selected = null;
  app.innerHTML = `<section class="hero"><span class="brand">CINEVA</span><h1>${SERIES}</h1><p>A brilliant mind. An extraordinary journey.</p><div><button class="primary" id="play">▶ Play</button><button class="secondary" id="episodes">Episodes</button></div></section><h2>Episodes</h2><div class="season-row">${[1,2,3,4,5,6,7].map(n => `<button class="season ${n === season ? "active" : ""}" data-season="${n}">Season ${n}</button>`).join("")}</div><section id="episodes-list">${episodeList().map(e => `<button class="episode" data-episode="${e.number}"><b>S${String(e.season).padStart(2,"0")}E${String(e.number).padStart(2,"0")} · ${e.title}</b><small>43 min · Open in player</small></button>`).join("")}</section>`;
  document.querySelector("#play").onclick = () => renderPlayer(episodeFor(1));
  document.querySelector("#episodes").onclick = () => document.querySelector("#episodes-list").scrollIntoView({behavior:"smooth"});
  document.querySelectorAll("[data-season]").forEach(button => button.onclick = () => { season = Number(button.dataset.season); renderCatalog(); });
  document.querySelectorAll("[data-episode]").forEach(button => button.onclick = () => renderPlayer(episodeFor(Number(button.dataset.episode))));
}
function renderPlayer(episode) {
  selected = episode;
  const saved = JSON.parse(localStorage.getItem(key(episode)) || "{}");
  app.innerHTML = `<button class="back" id="back">‹ Back to episodes</button><iframe class="player" id="player" src="${embedURL(episode)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><section class="now"><span class="brand">S${String(episode.season).padStart(2,"0")}E${String(episode.number).padStart(2,"0")}</span><h2>${episode.title}</h2><div class="progress"><i id="bar" style="width:${saved.progress || 0}%"></i></div><p id="time">${saved.currentTime ? `Resume from ${Math.floor(saved.currentTime)} seconds` : "Playback progress is saved on this iPhone."}</p><div class="notice">This player is configured for content you are authorized to show.</div></section>`;
  document.querySelector("#back").onclick = renderCatalog;
}
window.addEventListener("message", event => {
  let payload; try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
  if (!selected || payload?.type !== "PLAYER_EVENT") return;
  const data = payload.data || {}; const duration = Number(data.duration) || 0; const currentTime = Number(data.currentTime) || 0;
  if (!duration) return;
  const progress = Math.min(100, currentTime / duration * 100);
  localStorage.setItem(key(selected), JSON.stringify({ currentTime, duration, progress }));
  const bar = document.querySelector("#bar"), time = document.querySelector("#time");
  if (bar) bar.style.width = `${progress}%`; if (time) time.textContent = `${Math.floor(currentTime)}s of ${Math.floor(duration)}s`;
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js");
renderCatalog();
