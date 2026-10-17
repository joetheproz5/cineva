// Real CDN artwork, real active service worker, and production CSP (no account mutations).
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.SEVEN_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const policy = fs.readFileSync(path.join(root, '_headers'), 'utf8').match(/Content-Security-Policy: (.+)/)[1];
const remote = 'https://seven-9fm.pages.dev';
let pool = [];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(url.pathname.endsWith('/tv/71712') ? { ...pool[0], id: 71712, name: 'Artwork QA', genres: [{ id: 18 }] } : { results: [], total_pages: 1 })); return;
  }
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Security-Policy', policy);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
(async () => {
  for (const type of ['movie', 'tv']) {
    const response = await fetch(remote + '/api/tmdb/trending/' + type + '/week'); assert.equal(response.status, 200);
    const body = await response.json(); pool.push(...body.results.filter(item => item.poster_path && item.backdrop_path).slice(0, 8).map(item => ({ ...item, type })));
  }
  assert.equal(pool.length, 16);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.SEVEN_LIVE ? remote : 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'allow' });
      await context.addInitScript(() => localStorage.setItem('seven.account.settings', JSON.stringify({ preferences: { introEnabled: false, autoplayPreviews: false } })));
      const page = await context.newPage(), failures = [];
      page.on('requestfailed', request => { if (request.url().includes('image.tmdb.org')) failures.push([request.url(), request.failure()]); });
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('service-worker.js?v=384', { updateViaCache: 'none' });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      });
      // A unique query makes these genuinely uncached fetches through the worker.
      const urls = pool.map(item => 'https://image.tmdb.org/t/p/w500' + item.poster_path + '?artwork-qa=' + Date.now());
      const loaded = await page.evaluate(urls => Promise.all(urls.map(src => new Promise(resolve => {
        const image = new Image(); image.onload = () => resolve({ src, width: image.naturalWidth }); image.onerror = () => resolve({ src, width: 0 }); image.src = src;
      }))), urls);
      assert.ok(loaded.every(image => image.width === 500), JSON.stringify(loaded.filter(image => !image.width)));
      await page.waitForFunction(() => typeof render === 'function' && typeof state !== 'undefined');
      await page.evaluate(items => { state.featuredPool = items; state.featuredIndex = 0; state.featured = items[0]; render(); }, pool.slice(0, 3));
      await page.waitForSelector('[data-spotlight-title="movie:' + pool[0].id + '"]', { timeout: 30000 });
      const hero = await page.locator('.home-hero-backdrop').evaluate(element => element.style.backgroundImage);
      assert.ok(hero.includes(pool[0].backdrop_path), 'Hero must show the actual backdrop, not a fallback');
      assert.deepEqual(failures, []);
      console.log('PASS', width, '16 real movie/series posters plus full-resolution hero with active service worker');
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
