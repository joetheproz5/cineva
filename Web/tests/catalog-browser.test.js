const assert = require("node:assert/strict");
const test = require("node:test");
const browser = require("../catalog-browser.js");
const row = (id, extra = {}) => ({ id, title:`Movie ${id}`, genre_ids:[28], release_date:"2026-01-01", vote_average:8, ...extra });
const page = (start, count = 20) => Array.from({ length:count }, (_, index) => row(start + index));

test("remote collections append 20 titles per click and stop at the last page", async () => {
  const view = browser.create([{ path:"movie/popular", type:"movie" }]);
  const fetch = async (_, params) => ({ total_pages:3, results:page((params.page - 1) * 20 + 1, params.page === 3 ? 7 : 20) });
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 20);
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 40);
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 47); assert.equal(view.exhausted, true);
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 47);
});
test("duplicate titles and profile restrictions are skipped while filling a batch", async () => {
  const view = browser.create([{ path:"movie/popular", type:"movie" }]);
  const fetch = async (_, params) => ({ total_pages:3, results:params.page === 1 ? page(1) : params.page === 2 ? page(11) : page(31) });
  await browser.loadBatch(view, fetch, item => item.id % 2 === 0);
  assert.equal(view.items.length, 20); assert.equal(new Set(view.items.map(item => item.id)).size, 20);
  assert.ok(view.items.every(item => item.id % 2 === 0));
});
test("mixed collections distinguish movie and series IDs and preserve each source's buffer", async () => {
  const view = browser.create([{ path:"movie/popular", type:"movie" }, { path:"tv/popular", type:"tv" }]);
  const fetch = async (_, params) => ({ total_pages:2, results:page((params.page - 1) * 20 + 1) });
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 20);
  assert.equal(view.items.filter(item => item.type === "tv").length, 10);
  await browser.loadBatch(view, fetch); assert.equal(view.items.length, 40);
  assert.equal(new Set(view.items.map(item => `${item.type}:${item.id}`)).size, 40);
});
test("local collections paginate and sort without editing their source array", async () => {
  const rows = page(1, 45), view = browser.create([], rows, { sort:"vote_average.desc" });
  rows[24].vote_average = 10;
  await browser.loadBatch(view, async () => { throw Error("unexpected fetch"); });
  assert.equal(view.items.length, 20); assert.equal(view.items[0].id, 25); assert.equal(rows[0].id, 1);
  await browser.loadBatch(view, async () => {}); assert.equal(view.items.length, 40);
  await browser.loadBatch(view, async () => {}); assert.equal(view.items.length, 45); assert.ok(view.exhausted);
});
test("filters really narrow results and reset the page on a new selection", async () => {
  const sources = [{ path:"movie/popular", type:"movie" }, { path:"tv/popular", type:"tv" }];
  const fetch = async () => ({ total_pages:1, results:[row(1), row(2, { genre_ids:[35], vote_average:4 }), row(3, { release_date:"1999-01-01" })] });
  const view = browser.create(sources, [], { type:"movie", genre:"28:10759", score:"7", date:"five" });
  await browser.loadBatch(view, fetch); assert.deepEqual(view.items.map(item => item.id), [1]);
  const reset = browser.create(sources, [], { type:"tv" });
  await browser.loadBatch(reset, fetch); assert.equal(reset.sources[0].page, 1); assert.ok(reset.items.every(item => item.type === "tv"));
});
test("discovery filters intersect category constraints rather than replacing them", () => {
  const source = { path:"discover/movie", type:"movie", page:0, params:{ with_genres:"16|10751", "primary_release_date.gte":"2027-01-01", sort_by:"primary_release_date.asc" } };
  const params = browser.paramsFor(source, { ...browser.defaults, genre:"28:10759", date:"five", score:"8", sort:"newest" });
  assert.equal(params.with_genres, "16|10751,28"); assert.equal(params["primary_release_date.gte"], "2027-01-01");
  assert.equal(params["vote_average.gte"], 8); assert.equal(params.sort_by, "primary_release_date.desc");
  assert.equal(browser.paramsFor({ ...source, type:"tv", path:"discover/tv" }, { ...browser.defaults, sort:"newest" }).sort_by, "first_air_date.desc");
});
test("double clicks cannot start two requests and failed pages are retryable", async () => {
  const view = browser.create([{ path:"movie/popular", type:"movie" }]);
  let resolve, calls = 0;
  const first = browser.loadBatch(view, () => { calls++; return new Promise(done => { resolve = done; }); });
  await browser.loadBatch(view, async () => { calls++; }); assert.equal(calls, 1);
  resolve({ total_pages:2, results:page(1) }); await first;
  await browser.loadBatch(view, async () => { throw Error("Offline"); });
  assert.equal(view.items.length, 20); assert.equal(view.sources[0].page, 1); assert.equal(view.error, "Offline");
  await browser.loadBatch(view, async (_, params) => { assert.equal(params.page, 2); return { total_pages:2, results:page(21) }; });
  assert.equal(view.items.length, 40); assert.equal(view.error, "");
});
test("a request completing after leaving the collection cannot change its visible items", async () => {
  const view = browser.create([{ path:"movie/popular", type:"movie" }]);
  let current = true, resolve;
  const pending = browser.loadBatch(view, () => new Promise(done => { resolve = done; }), () => true, () => current);
  current = false; resolve({ total_pages:1, results:page(1) }); await pending;
  assert.equal(view.items.length, 0); assert.equal(view.loading, false);
});
