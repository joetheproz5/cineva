const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const web=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(web,'app.js'),'utf8');
const css=fs.readFileSync(path.join(web,'ui.css'),'utf8');
const spotlight=fs.readFileSync(path.join(web,'hero-spotlight.js'),'utf8');

test('phone hero uses the title poster responsively while keeping the backdrop fallback',()=>{
  assert.match(app,/posterPath \? `<picture class="home-hero-phone-art"><source media="\(max-width: 767px\)"/);
  assert.match(app,/w500\$\{escapeHTML\(posterPath\)\} 500w, \$\{escapeHTML\(posterBase\)\}\/w780\$\{escapeHTML\(posterPath\)\} 780w/);
  assert.match(app,/f\.backdrop_path \? `\$\{TMDB_BACKDROP\}\$\{f\.backdrop_path\}` : posterOf\(f\)/);
  assert.match(app,/posterPath \? `[\s\S]*?` : ""/);
  assert.match(app,/f === state\.featured \? "eager" : "lazy"/);
  assert.match(app,/loading="\$\{posterLoading\}" fetchpriority="\$\{posterLoading === "eager" \? "high" : "auto"\}"/);
  assert.match(spotlight,/phonePoster\.addEventListener\("load", revealPoster\)/);
  assert.match(spotlight,/phonePoster\.naturalWidth > 1/);
});

test('mobile hero sizing, contrast layers, copy placement and poster cross-fade are phone scoped',()=>{
  const mobileHero=css.slice(css.lastIndexOf('@media (max-width:767px) {'));
  assert.match(mobileHero,/height:66svh;[\s\S]*?min-height:480px;[\s\S]*?max-height:640px/);
  assert.match(mobileHero,/linear-gradient\(180deg,transparent 40%[\s\S]*?var\(--bg,#050505\) 100%\)/);
  assert.doesNotMatch(mobileHero,/linear-gradient\(90deg/);
  assert.match(mobileHero,/background:rgba\(0,0,0,\.08\)/);
  assert.match(mobileHero,/background-position:65% 20%/);
  assert.match(mobileHero,/object-fit:cover;[\s\S]*?object-position:center top/);
  assert.match(mobileHero,/padding:0 20px 114px/);
  assert.match(mobileHero,/hero-synopsis \{ -webkit-line-clamp:2 !important/);
  assert.match(mobileHero,/hero-indicators \{ bottom:20px/);
  assert.match(mobileHero,/transition:opacity 200ms ease/);
  assert.match(css,/\.home-page \.hero \.home-hero-phone-art \{ display:none; \}/);
  assert.match(spotlight,/duration:620, easing:"cubic-bezier\(\.22,\.72,\.22,1\)"/);
});
