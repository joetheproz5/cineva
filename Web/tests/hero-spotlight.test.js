const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const {createImageLoader}=require('../hero-spotlight.js');
function fixture(options={}) {
 const images=[];
 class ImageFixture {constructor(){this.naturalWidth=1280;images.push(this);} decode(){return this.decoded||Promise.resolve();}set src(value){this.url=value;}}
 return {images,loader:createImageLoader({ImageClass:ImageFixture,...options})};
}
test('spotlight artwork is ready only after both image load and decode finish',async()=>{
 const {images,loader}=fixture();let decoded,ready=false;
 const pending=loader.load('/next.jpg').then(result=>{ready=true;return result;});
 images[0].decoded=new Promise(resolve=>{decoded=resolve;});images[0].onload();await Promise.resolve();assert.equal(ready,false);
 decoded();const result=await pending;assert.equal(result.url,'/next.jpg');assert.equal(ready,true);
});
test('preloading and selecting the same image share one network/decode promise',async()=>{
 const {images,loader}=fixture();const first=loader.load('/next.jpg'),second=loader.load('/next.jpg');assert.equal(first,second);assert.equal(images.length,1);images[0].onload();await first;assert.equal(loader.load('/next.jpg'),first);
});
test('failed and timed-out artwork can be retried instead of poisoning the cache',async()=>{
 const {images,loader}=fixture({timeout:10});let first=loader.load('/broken.jpg');images[0].onerror();await assert.rejects(first);
 first=loader.load('/broken.jpg');assert.equal(images.length,2);images[1].onload();await first;
 await assert.rejects(loader.load('/timeout.jpg'),/timed out/);assert.equal(images[2].onload,null);
 const retry=loader.load('/timeout.jpg');images[3].onload();await retry;
});
test('fallback poster artwork must also decode before a title is allowed to appear',async()=>{
 const {images,loader}=fixture();const pending=loader.first(['/bad.jpg','/poster.jpg','/poster.jpg']);images[0].onerror();await Promise.resolve();await Promise.resolve();assert.equal(images.length,2);assert.equal(images[1].url,'/poster.jpg');images[1].onload();assert.equal((await pending).url,'/poster.jpg');
});
test('decoded image cache is bounded instead of retaining every full-size spotlight',async()=>{
 const {images,loader}=fixture({limit:2});for(const url of ['/one','/two','/three']){const promise=loader.load(url);images.at(-1).onload();await promise;}
 const again=loader.load('/one');assert.equal(images.length,4);images.at(-1).onload();await again;
});
test('a broken decoder or an empty image cannot expose a partially prepared slide',async()=>{
 const {images,loader}=fixture();const first=loader.load('/bad-decode');images[0].decoded=Promise.reject(Error('Decode failed'));images[0].onload();await assert.rejects(first,/Decode failed/);
 const second=loader.load('/empty');images[1].naturalWidth=0;images[1].onload();await assert.rejects(second,/Empty/);
});
test('Home switches artwork and copy together only after readiness, and uses horizontal motion',()=>{
 const js=fs.readFileSync(path.resolve(__dirname,'../hero-spotlight.js'),'utf8'),css=fs.readFileSync(path.resolve(__dirname,'../hero-spotlight.css'),'utf8'),app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
 assert.ok(js.indexOf('await loader.first(artwork(view.pool[target]))')<js.indexOf('state.featured = view.pool[target]'));
 assert.match(js,/ticket !== view.ticket/);assert.match(js,/view.scope === scope\(\)/);assert.match(js,/view.pool === state.featuredPool/);
 assert.match(js,/translateX\(/);assert.doesNotMatch(js,/translateY\(/);assert.match(css,/animation: none !important/);
 assert.match(js,/previous.setAttribute\("aria-hidden", "true"\); previous.inert = true/);
 assert.match(js,/automatic && \(view.loading \|\| document.hidden\)/);assert.match(app,/window.SEVENHero.preload\(state.featuredPool\)/);
 assert.match(app,/state.route !== "home"\) window.SEVENHero\?\.cancel\(\)/);
});
test('spotlight assets load before the app and are available in the offline shell',()=>{
 const web=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(web,'index.html'),'utf8'),worker=fs.readFileSync(path.join(web,'service-worker.js'),'utf8');
 for(const file of ['hero-spotlight.js?v=1','hero-spotlight.css?v=1']){assert.ok(index.includes(file));assert.ok(worker.includes(file));}
 assert.ok(index.indexOf('hero-spotlight.js?v=1')<index.indexOf('app.js?v=380'));
});
