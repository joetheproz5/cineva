const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(web, "manifest.webmanifest"), "utf8");
const serviceWorker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "ui.css"), "utf8");
const baseStyles = fs.readFileSync(path.join(web, "styles.css"), "utf8");
const startupTheme = fs.readFileSync(path.join(web, "startup-theme.css"), "utf8");
const startupConfig = JSON.parse(fs.readFileSync(path.join(web, "startup-theme.json"), "utf8"));

test("the launch ident and PWA files work from a project subpath", () => {
  assert.match(app, /startup-intro-mark" src="assets\/seven-wordmark-v2\.png"/);
  assert.match(app, /serviceWorker\.register\("service-worker\.js\?v=\d+",\s*\{ updateViaCache:"none" \}\)/);
  assert.doesNotMatch(index, /(?:href|src)="\//);
  assert.match(manifest, /"start_url": "\.\/"/);
  assert.match(manifest, /"scope": "\.\/"/);
  assert.match(serviceWorker, /const VERSION = "seven-v\d+"/);
  assert.match(serviceWorker, /const scopePath = new URL\(self\.registration\.scope\)\.pathname/);
});

test("iOS launch screens, page chrome, and intro use the same SEVEN dark theme", () => {
  const baseColor = startupConfig.background.baseColor;
  assert.match(index, new RegExp(`<meta name="theme-color" content="${baseColor}"\\s*\\/>`));
  assert.match(manifest, new RegExp(`"background_color": "${baseColor}"`));
  assert.match(manifest, new RegExp(`"theme_color": "${baseColor}"`));
  assert.match(startupTheme, new RegExp(`--seven-startup-background-color: ${baseColor}`));
  assert.match(baseStyles, /--bg:var\(--seven-startup-background-color,#080608\)/);
  assert.match(styles, /html\.seven-launching,html\.seven-launching body \{ background: var\(--seven-startup-background\); \}/);
  assert.match(index, /viewport-fit=cover/);
  assert.doesNotMatch(index + manifest, /#071018/i);
  const splashImages = [...index.matchAll(/href="(assets\/splash\/[^\"]+\.png\?v=4)"/g)];
  assert.equal(splashImages.length, 28);
  for (const [, image] of splashImages) assert.ok(fs.existsSync(path.join(web, image.split("?")[0])), `${image} should exist`);
  assert.match(index, /device-width: 440px[^\n]+1320x2868\.png\?v=4/);
  assert.match(index, /device-width: 420px[^\n]+1260x2736\.png\?v=4/);
});

test("the branded launch frame is painted before the application scripts run", () => {
  const launchFlag = index.indexOf('document.documentElement.classList.add("seven-launching")');
  const stylesheet = index.indexOf('href="startup-theme.css?v=2"');
  const introMarkup = index.indexOf('<div class="seven-intro"');
  const appRoot = index.indexOf('<main id="app">');
  assert.ok(launchFlag >= 0 && launchFlag < stylesheet, "launch state should be set before styles and app scripts load");
  assert.ok(introMarkup >= 0 && introMarkup < appRoot, "the intro should exist before app.js can execute");
  assert.match(styles, /html:not\(\.seven-launching\) \.seven-intro:not\(\.exiting\) \{ display: none; \}/);
  assert.match(styles, /\.seven-intro \{[^}]*background: var\(--seven-startup-background\)/);
  assert.match(styles, /\.startup-intro-mark \{[^}]*opacity: 1; filter: none/);
});
