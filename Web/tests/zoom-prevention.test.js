const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("web app pages disable browser zoom without disabling touch panning", () => {
  for (const file of ["Web/index.html", "Web/download.html", "Web/dashboard.html", "Android/app/src/main/assets/offline.html"]) {
    const html = read(file);
    assert.match(html, /name="viewport"[^>]*maximum-scale=1[^>]*user-scalable=no/i, `${file} should lock page zoom`);
  }
  const styles = read("Web/ui.css");
  assert.match(styles, /html,body \{ touch-action: pan-x pan-y; \}/);
  assert.match(styles, /@media \(pointer: coarse\), \(max-width: 650px\)[\s\S]*?textarea,select \{ font-size: 16px !important; \}/);
  assert.match(read("Web/dashboard.html"), /html,body\{touch-action:pan-x pan-y\}[\s\S]*?textarea,select\{font-size:16px!important\}/);
  assert.match(read("Web/download.html"), /html,body\{touch-action:pan-x pan-y\}/);
});

test("desktop and Android wrappers disable their native webview zoom gestures", () => {
  const android = read("Android/app/src/main/java/com/example/cineva/MainActivity.kt");
  assert.match(android, /settings\.setSupportZoom\(false\)/);
  assert.match(android, /settings\.builtInZoomControls = false/);
  assert.match(android, /settings\.displayZoomControls = false/);

  const mac = read("Mac/Sources/SEVENApp.swift");
  assert.match(mac, /webView\.allowsMagnification = false/);
  assert.match(mac, /webView\.pageZoom = 1\.0/);

  const windows = read("Windows/Seven.Desktop/MainWindow.xaml.cs");
  assert.match(windows, /core\.Settings\.IsZoomControlEnabled = false/);
});
