const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");

test("missing movie, episode, and profile art use SEVEN artwork instead of the app icon", () => {
  assert.match(app, /const POSTER_FALLBACK = "\/assets\/poster-placeholder\.svg"/);
  assert.match(app, /const STILL_FALLBACK = "\/assets\/still-placeholder\.svg"/);
  assert.match(app, /const PROFILE_FALLBACK = "\/assets\/profile-placeholder\.svg"/);
  assert.match(app, /const posterOf = item => item\.poster_path \? `[\s\S]*?` : POSTER_FALLBACK/);
  assert.match(app, /episode\.still_path \? TMDB_IMAGE \+ episode\.still_path : STILL_FALLBACK/);
  assert.doesNotMatch(app, /"icon\.svg"/);

  for (const asset of ["poster-placeholder.svg", "still-placeholder.svg", "profile-placeholder.svg"]) {
    const artwork = fs.readFileSync(path.join(web, "assets", asset), "utf8");
    assert.match(artwork, /<svg[\s\S]*viewBox=/);
    assert.match(artwork, /SEVEN/);
    assert.doesNotMatch(artwork, /#d1ff47/i);
  }
});

test("failed TMDB images fall back to artwork that matches their shape", () => {
  const source = app.match(/function fallbackRemoteArtwork\(event\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "remote artwork error handler should exist");
  const evaluate = (classes, src = "https://image.tmdb.org/t/p/w500/missing.jpg") => {
    const image = {
      tagName: "IMG",
      src,
      currentSrc: src,
      dataset: {},
      classes,
      classList: { added:[], add(value) { this.added.push(value); } },
      closest(selector) {
        const selectors = selector.split(",").map(value => value.trim().slice(1));
        return selectors.some(value => this.classes.includes(value)) ? {} : null;
      }
    };
    const context = {
      image,
      POSTER_FALLBACK:"/assets/poster-placeholder.svg",
      STILL_FALLBACK:"/assets/still-placeholder.svg",
      PROFILE_FALLBACK:"/assets/profile-placeholder.svg"
    };
    vm.runInNewContext(`${source}; fallbackRemoteArtwork({ target:image });`, context);
    return image;
  };

  assert.equal(evaluate(["poster-wrap"]).src, "/assets/poster-placeholder.svg");
  assert.equal(evaluate(["episode-art"]).src, "/assets/still-placeholder.svg");
  assert.equal(evaluate(["person-photo"]).src, "/assets/profile-placeholder.svg");
  const localImage = evaluate(["poster-wrap"], "/assets/poster-placeholder.svg");
  assert.equal(localImage.dataset.artworkFallback, undefined);
});

test("service worker caches fallback art and updates in lockstep with the app", () => {
  const appVersion = app.match(/register\("service-worker\.js\?v=(\d+)"/)?.[1];
  const htmlVersion = fs.readFileSync(path.join(web, "index.html"), "utf8").match(/app\.js\?v=(\d+)/)?.[1];
  const shellVersion = serviceWorker.match(/"app\.js\?v=(\d+)"/)?.[1];
  const cacheVersion = serviceWorker.match(/seven-v(\d+)/)?.[1];
  assert.ok(appVersion);
  assert.equal(htmlVersion, appVersion);
  assert.equal(shellVersion, appVersion);
  assert.equal(cacheVersion, appVersion);
  for (const asset of ["poster-placeholder.svg", "still-placeholder.svg", "profile-placeholder.svg"]) {
    assert.ok(serviceWorker.includes(`assets/${asset}`));
  }
});
