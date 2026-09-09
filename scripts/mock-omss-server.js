// Minimal OMSS-style mock of a CinePro Core instance for local verification.
// Serves /v1 health, /v1/movies/:id, /v1/tv/:id/seasons/:s/episodes/:e, and a fake HLS stream.
const http = require("http");

const MOVIE_SOURCES = [
  { id: "s1", url: "http://127.0.0.1:3210/stream/master.m3u8", streamable: true, type: "hls", quality: "4k", audioTracks: ["Original"], provider: { id: "alpha", name: "Provider Alpha" } },
  { id: "s2", url: "http://127.0.0.1:3210/stream/video.mp4", streamable: true, type: "mp4", quality: "FHD", audioTracks: ["English"], provider: { id: "beta", name: "Provider Beta" } }
];

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3210");
  const send = (payload, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(payload)); };
  if (url.pathname === "/v1" || url.pathname === "/v1/") return send({ status: "ok", omss: "1.1.0", mock: true });
  if (url.pathname.startsWith("/v1/movies/")) return send({ id: "mock", expiresAt: new Date(Date.now() + 3600_000).toISOString(), sources: MOVIE_SOURCES, subtitles: [{ id: "sub1", url: "http://127.0.0.1:3210/stream/subs.vtt", label: "English", format: "vtt", provider: { id: "alpha", name: "Provider Alpha" } }], diagnostics: [] });
  if (/^\/v1\/tv\/\d+\/seasons\/\d+\/episodes\/\d+$/.test(url.pathname)) return send({ id: "mock", expiresAt: new Date(Date.now() + 3600_000).toISOString(), sources: MOVIE_SOURCES, subtitles: [], diagnostics: [] });
  if (url.pathname.startsWith("/stream/")) {
    response.writeHead(200, { "Content-Type": url.pathname.endsWith(".vtt") ? "text/vtt" : url.pathname.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp4" });
    if (url.pathname.endsWith(".vtt")) return response.end("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello from the mock stream\n");
    return response.end(Buffer.alloc(64, 1)); // 64 fake bytes of "video"
  }
  send({ error: "not found" }, 404);
});

server.listen(3210, "127.0.0.1", () => console.log("Mock OMSS server on http://127.0.0.1:3210"));
