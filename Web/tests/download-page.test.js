const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const downloadPage = fs.readFileSync(path.join(repository, "Web/download.html"), "utf8");
const releaseWorkflow = fs.readFileSync(path.join(repository, ".github/workflows/windows-build.yml"), "utf8");
const desktopHost = fs.readFileSync(path.join(repository, "Windows/Seven.Desktop/MainWindow.xaml.cs"), "utf8");

test("the Windows download button points at the desktop executable published by CI", () => {
  assert.match(downloadPage, /href="https:\/\/github\.com\/joetheproz5\/cineva\/releases\/latest\/download\/SEVEN-Desktop-win-x64\.exe"/);
  assert.match(releaseWorkflow, /Publish self-contained Windows app/);
  assert.match(releaseWorkflow, /dist\/windows\/SEVEN\.exe/);
  assert.match(releaseWorkflow, /--latest/);
});

test("the redesigned download page retains iPhone, Android, and QR install paths", () => {
  assert.match(downloadPage, /id="iosBtn"/);
  assert.match(downloadPage, /id="androidBtn" href="\/downloads\/seven\.apk"/);
  assert.match(downloadPage, /id="qrImage"/);
});

test("the desktop wrapper confines embedded navigation to SEVEN and opens web links externally", () => {
  assert.match(desktopHost, /target\.Scheme\.Equals\(Uri\.UriSchemeHttps/);
  assert.match(desktopHost, /target\.IdnHost\.Equals\(AppHost/);
  assert.match(desktopHost, /OpenExternal\(target\)/);
});
