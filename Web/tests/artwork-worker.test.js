const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

function worker({ cache, openError, response = new Response('image'), networkError } = {}) {
  const handlers = {}, pending = []; let requests = 0;
  vm.runInNewContext(source, {
    URL, location: { origin: 'https://seven.test' },
    self: { addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: { open: async () => { if (openError) throw openError; return cache; } },
    fetch: async () => { requests++; if (networkError) throw networkError; return response; }
  });
  return {
    async image() {
      let result;
      handlers.fetch({ request: new Request('https://image.tmdb.org/t/p/w500/poster.jpg'),
        respondWith: promise => { result = promise; }, waitUntil: promise => pending.push(promise) });
      return await result;
    },
    pending, requests: () => requests
  };
}

test('both deployed and document security policies allow the exact artwork fetch origin', () => {
  for (const file of ['_headers', 'index.html']) {
    const policy = fs.readFileSync(path.join(root, file), 'utf8').match(/connect-src ([^;]+)/)[1];
    assert.ok(policy.split(/\s+/).includes('https://image.tmdb.org'), file);
    assert.doesNotMatch(policy, /(?:^|\s)(?:\*|https:)(?:\s|$)/, 'No broad network permission');
  }
  assert.match(source, /seven-images-v2/);
});
test('image cache hits remain available offline', async () => {
  const image = new Response('cached'), w = worker({ cache: { match: async () => image } });
  assert.equal(await (await w.image()).text(), 'cached'); assert.equal(w.requests(), 0);
});
test('cache open, lookup, quota, enumeration and eviction failures cannot hide network artwork', async () => {
  const fault = async () => { throw Error('Storage unavailable'); };
  for (const options of [
    { openError: Error('Storage blocked') },
    { cache: { match: fault } },
    { cache: { match: async () => null, put: fault } },
    { cache: { match: async () => null, put: async () => {}, keys: fault } },
    { cache: { match: async () => null, put: async () => {}, keys: async () => Array(121).fill('old'), delete: fault } }
  ]) {
    const w = worker(options);
    assert.equal(await (await w.image()).text(), 'image');
    await Promise.all(w.pending); assert.equal(w.requests(), 1);
  }
});
test('image response does not wait for the background cache write', async () => {
  let release;
  const w = worker({ cache: { match: async () => null, put: () => new Promise(r => { release = r; }), keys: async () => [] } });
  assert.equal(await (await w.image()).text(), 'image'); assert.equal(w.pending.length, 1);
  release(); await Promise.all(w.pending);
});
test('HTTP failures are not saved and real network failures remain failures', async () => {
  let writes = 0;
  const w = worker({ response: new Response('missing', { status: 404 }), cache: { match: async () => null, put: async () => { writes++; } } });
  assert.equal((await w.image()).status, 404); assert.equal(writes, 0);
  await assert.rejects(worker({ openError: Error('Blocked storage'), networkError: Error('Offline') }).image(), /Offline/);
});
