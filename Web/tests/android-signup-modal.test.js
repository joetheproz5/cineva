const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const authCss = fs.readFileSync(path.join(root, "Web", "auth.css"), "utf8");
const mobileCss = fs.readFileSync(path.join(root, "Web", "ui.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "Web", "app.js"), "utf8");
const android = fs.readFileSync(path.join(root, "Android", "app", "src", "main", "java", "com", "example", "cineva", "MainActivity.kt"), "utf8");
const androidGradle = fs.readFileSync(path.join(root, "Android", "app", "build.gradle.kts"), "utf8");

function zIndex(rule) {
  return Number(rule.match(/z-index:\s*(\d+)/)?.[1] || 0);
}

test("signup dialog stays above the Android-sized mobile navigation", () => {
  const modal = authCss.match(/\.modal\s*\{([^}]*)\}/)?.[1] || "";
  const mobileNav = mobileCss.match(/#app\s*>\s*\.app-mobile-nav\s*\{([^}]*)\}/)?.[1] || "";

  assert.ok(zIndex(modal) > zIndex(mobileNav));
});

test("account dialogs scroll within the keyboard-adjusted viewport", () => {
  assert.match(authCss, /\.auth-card\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*24px\);[^}]*overflow-y:\s*auto;/);
  assert.match(authCss, /@supports\s*\(height:\s*100dvh\)[\s\S]*?\.auth-card\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*24px\);/);
  assert.match(authCss, /\.auth-flow\s*\{[^}]*overflow-x:\s*hidden;\s*overflow-y:\s*auto;/);
});

test("the Android app has no pull-to-refresh wrapper", () => {
  assert.doesNotMatch(android, /SwipeRefreshLayout|refreshLayout|\.reload\(\)/);
  assert.doesNotMatch(androidGradle, /swiperefreshlayout/i);
  assert.match(android, /root\.addView\(web,/);
});

test("pull-to-refresh is disabled only for installed PWAs, not browser pages", () => {
  const rules = [...mobileCss.matchAll(/([^{}]+)\{([^{}]*overscroll-behavior-y\s*:[^{}]*)\}/g)];

  assert.equal(rules.length, 1);
  assert.match(rules[0][1], /html\.seven-installed-pwa/);
  assert.match(rules[0][2], /overscroll-behavior-y:\s*none/);
  assert.match(appJs, /display-mode:\s*standalone[\s\S]*navigator\.standalone\s*===\s*true/);
  assert.match(appJs, /classList\.add\("seven-installed-pwa"\)/);
});

test("Android keyboard viewport resize cannot redraw away the signup dialog", () => {
  const resizeHandler = appJs.match(/window\.addEventListener\("resize",[\s\S]*?\{ passive:true \}\);/)?.[0] || "";

  assert.ok(resizeHandler, "home resize handler should remain covered");
  assert.ok(resizeHandler.indexOf('document.querySelector(".modal")') < resizeHandler.indexOf("render()"));
  assert.match(resizeHandler, /window\.innerWidth/);
  assert.match(resizeHandler, /viewportWidth === coverflowViewportWidth/);
});
