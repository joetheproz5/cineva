const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const downloadPage = fs.readFileSync(path.join(repository, "Web/download.html"), "utf8");
const responseHeaders = fs.readFileSync(path.join(repository, "Web/_headers"), "utf8");
const releaseWorkflow = fs.readFileSync(path.join(repository, ".github/workflows/desktop-build.yml"), "utf8");
const installerScript = fs.readFileSync(path.join(repository, "Windows/Seven.Desktop/installer.iss"), "utf8");
const desktopHost = fs.readFileSync(path.join(repository, "Windows/Seven.Desktop/MainWindow.xaml.cs"), "utf8");
const macHost = fs.readFileSync(path.join(repository, "Mac/Sources/SEVENApp.swift"), "utf8");
const macManifest = fs.readFileSync(path.join(repository, "Mac/Info.plist"), "utf8");

test("the Windows download points at the installer in the combined desktop release", () => {
  assert.match(downloadPage, /href="https:\/\/github\.com\/joetheproz5\/cineva\/releases\/latest\/download\/SEVEN-Setup-win-x64\.exe"/);
  assert.match(releaseWorkflow, /Publish self-contained Windows app/);
  assert.match(releaseWorkflow, /--output dist\/windows/);
  assert.match(releaseWorkflow, /dist\/installer\/SEVEN-Setup-win-x64\.exe/);
  assert.match(releaseWorkflow, /SEVEN-Setup-win-x64\.exe/);
  assert.match(installerScript, /Source: "\.\.\\\.\.\\dist\\windows\\\{#AppExecutable\}"/);
  assert.match(releaseWorkflow, /--latest/);
  assert.match(installerScript, /DefaultGroupName=SEVEN/);
});

test("the Mac wrapper is native, universal, and published as a disk image", () => {
  assert.match(downloadPage, /id="macBtn" href="https:\/\/github\.com\/joetheproz5\/cineva\/releases\/latest\/download\/SEVEN-macOS\.dmg"/);
  assert.match(releaseWorkflow, /swift build --configuration release --arch arm64/);
  assert.match(releaseWorkflow, /swift build --configuration release --arch x86_64/);
  assert.match(releaseWorkflow, /lipo -create/);
  assert.match(releaseWorkflow, /hdiutil create/);
  assert.match(releaseWorkflow, /dist\/macos\/SEVEN-macOS\.dmg/);
  assert.match(releaseWorkflow, /needs: \[windows, macos\]/);
  assert.match(releaseWorkflow, /--repo joetheproz5\/cineva/);
  assert.match(macManifest, /<string>13\.0<\/string>/);
  assert.match(macHost, /WKWebView/);
});

test("the download page separates Apple installs from Windows and Android", () => {
  assert.match(downloadPage, /aria-labelledby="appleHeading"/);
  assert.match(downloadPage, /id="macCard"/);
  assert.match(downloadPage, /id="iosCard"/);
  assert.match(downloadPage, /aria-labelledby="otherPlatformsHeading"/);
  assert.match(downloadPage, /id="windowsCard"/);
  assert.match(downloadPage, /id="androidCard"/);
  assert.match(downloadPage, /id="iosBtn"/);
  assert.match(downloadPage, /id="androidBtn" href="\/downloads\/seven\.apk"/);
  assert.match(downloadPage, /id="qrImage"/);
  assert.match(downloadPage, /var isMac = \/Macintosh\|Mac OS X\//);
  assert.match(responseHeaders, /\/download\.html\s+Cache-Control: no-store, no-cache, must-revalidate/);
});

test("the desktop wrapper confines embedded navigation to SEVEN and opens web links externally", () => {
  assert.match(desktopHost, /target\.Scheme\.Equals\(Uri\.UriSchemeHttps/);
  assert.match(desktopHost, /target\.IdnHost\.Equals\(AppHost/);
  assert.match(desktopHost, /OpenExternal\(target\)/);
  assert.match(macHost, /navigationAction\.targetFrame\?\.isMainFrame != false/);
  assert.match(macHost, /url\.host\?\.lowercased\(\) == sevenHost/);
  assert.match(macHost, /NSWorkspace\.shared\.open\(url\)/);
});
