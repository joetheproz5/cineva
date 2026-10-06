const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "ui.css"), "utf8");

test("mobile search cards share one poster frame and keep ratings clear", () => {
  assert.match(app, /function mobileSearchCard\(item\)/);
  assert.match(app, /items\.map\(mobileSearchCard\)/);
  assert.match(css, /\.msearch-card,\.msearch-skeleton\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(css, /\.msearch-poster,\.msearch-skeleton\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3;/);
  assert.match(css, /\.msearch-poster img\s*\{[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover;/);
  assert.match(css, /\.msearch-poster em\s*\{[\s\S]*?border-radius:\s*999px;/);
});

test("the player header presents episode context instead of a cinema brand", () => {
  const start = app.indexOf("function renderPlayer()");
  const end = app.indexOf("function bindPlayer", start);
  const player = app.slice(start, end);

  assert.match(player, /player-stage-context/);
  assert.match(player, /player-stage-actions/);
  assert.match(player, /party-quick/);
  assert.doesNotMatch(player, /SEVEN CINEMA/);
  assert.doesNotMatch(player, /party-start/);
  assert.match(css, /\.player-stage-context\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.player-stage-actions \.provider-menu\s*\{\s*grid-column:\s*2;\s*grid-row:\s*1;/);
  assert.match(app, /<circle cx="8" cy="8\.1" r="2\.25"\/>/);
  assert.match(css, /\.party-quick\s*\{[\s\S]*?border-radius:\s*13px;[\s\S]*?linear-gradient\(145deg,#f24a57,#b10817 72%\)/);
});

test("the mobile navigation does not reserve an extra bottom row", () => {
  assert.match(css, /#app > \.app-mobile-nav\s*\{[^}]*height:\s*calc\(66px \+ env\(safe-area-inset-bottom\)\);[^}]*min-height:\s*calc\(66px \+ env\(safe-area-inset-bottom\)\);[^}]*padding:\s*6px 8px calc\(6px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /\.player-episodes \.episode\s*\{\s*min-height:\s*0;/);
  assert.match(css, /\.player-episodes \.episode-main\s*\{\s*min-height:\s*65px;/);
  assert.match(css, /\.player-episodes \.player-episode-art img\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(css, /\.episode-current\s*\{\s*position:\s*absolute;[\s\S]*?bottom:\s*10px;/);
});

test("the mobile bottom navigation stays viewport-fixed while the header is scrolled", () => {
  const scrolledHeaderRules = [...css.matchAll(/header\.main-header\.app-header\.scrolled\s*\{([^}]*)\}/g)];
  const mobileScrolledHeader = scrolledHeaderRules.at(-1)?.[1] || "";
  const mobileNavRules = [...css.matchAll(/#app\s*>\s*\.app-mobile-nav\s*\{([^}]*)\}/g)];
  const mobileNav = mobileNavRules.at(-1)?.[1] || "";
  const activeNavRules = [...css.matchAll(/#app\s*>\s*\.app-mobile-nav\s+\.nav-link\.active\s*\{([^}]*)\}/g)];
  const activeNav = activeNavRules.at(-1)?.[1] || "";

  assert.match(app, /const mobileNavigation = `<nav class="app-mobile-nav" aria-label="Mobile main navigation">/);
  assert.match(app, /data-mobile-browse/);
  assert.match(app, /if \(!navigation\.querySelector\("\[data-watchlist\]"\)\)/);
  assert.match(app, /<\/header>\$\{mobileNavigation\}/);
  assert.match(app, /app\.querySelectorAll\("header nav, \.app-mobile-nav"\)/);
  assert.match(mobileScrolledHeader, /backdrop-filter:\s*blur\(18px\) saturate\(135%\);/);
  assert.match(css, /header\.main-header\.app-header\s*>\s*nav\s*\{\s*display:\s*none;/);
  assert.match(mobileNav, /position:\s*fixed;/);
  assert.match(mobileNav, /bottom:\s*0;/);
  assert.match(mobileNav, /right:\s*0;[^}]*left:\s*0;[^}]*width:\s*100%;/);
  assert.match(mobileNav, /background:\s*rgba\(14,15,17,\.78\);/);
  assert.match(mobileNav, /backdrop-filter:\s*blur\(20px\) saturate\(145%\);/);
  assert.match(mobileNav, /border-radius:\s*0;/);
  assert.match(activeNav, /border-radius:\s*14px;/);
});

test("Favourites gets the same active tab treatment when its page is open", () => {
  assert.match(app, /const favourites = navigation\.querySelector\("\[data-favourites\]"\), active = state\.route === "my-list"/);
  assert.match(app, /favourites\?\.classList\.toggle\("active", active\)/);
  assert.match(app, /favourites\?\.setAttribute\("aria-current", "page"\)/);
  assert.match(css, /#app > \.app-mobile-nav \.nav-link\.active\s*\{[^}]*border-radius:\s*14px;[^}]*background:/);
});

test("the mobile header fully hides while scrolling down and returns on scroll-up", () => {
  const start = app.indexOf("let lastMobileHeaderY =");
  const end = app.indexOf('\nwindow.addEventListener("scroll", syncHeaderScroll', start);
  const classes = new Set();
  let isMobile = true, focused = false;
  const header = {
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    },
    contains() { return focused; }
  };
  const window = { scrollY:0, matchMedia:() => ({ matches:isMobile }) };
  const document = { activeElement:{}, querySelector:selector => selector === "header.main-header.app-header" ? header : null };
  const context = { window, document, Math };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);

  context.syncHeaderScroll();
  window.scrollY = 90;
  context.syncHeaderScroll();
  assert.equal(classes.has("scroll-hidden"), true);
  window.scrollY = 74;
  context.syncHeaderScroll();
  assert.equal(classes.has("scroll-hidden"), false);
  focused = true;
  window.scrollY = 90;
  context.syncHeaderScroll();
  assert.equal(classes.has("scroll-hidden"), false);
  focused = false;
  window.scrollY = 110;
  context.syncHeaderScroll();
  assert.equal(classes.has("scroll-hidden"), true);
  isMobile = false;
  window.scrollY = 150;
  context.syncHeaderScroll();
  assert.equal(classes.has("scroll-hidden"), false);

  assert.match(css, /header\.main-header\.app-header\.scroll-hidden\s*\{[^}]*transform:\s*translate3d\(0,calc\(-100% - 24px\),0\);[^}]*opacity:\s*0;[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/);
});
