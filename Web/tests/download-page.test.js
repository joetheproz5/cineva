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
const windowsChrome = fs.readFileSync(path.join(repository, "Windows/Seven.Desktop/MainWindow.xaml"), "utf8");
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
  assert.match(downloadPage, /id="macBtn"[^>]*href="https:\/\/github\.com\/joetheproz5\/cineva\/releases\/latest\/download\/SEVEN-macOS\.dmg"/);
  assert.match(releaseWorkflow, /swift build --configuration release --arch arm64/);
  assert.match(releaseWorkflow, /swift build --configuration release --arch x86_64/);
  assert.match(releaseWorkflow, /lipo -create/);
  assert.match(releaseWorkflow, /hdiutil create/);
  assert.match(releaseWorkflow, /\.\.\/Web\/assets\/seven-logo-red\.png/);
  assert.match(releaseWorkflow, /dist\/macos\/SEVEN-macOS\.dmg/);
  assert.match(releaseWorkflow, /needs: \[windows, macos\]/);
  assert.match(releaseWorkflow, /--repo joetheproz5\/cineva/);
  assert.match(macHost, /setFrameAutosaveName\("SEVEN\.MainWindow"\)/);
  assert.match(macManifest, /<string>13\.0<\/string>/);
  assert.match(macHost, /WKWebView/);
});

test("the download page provides four platform jump links and dedicated install chapters", () => {
  for (const [id, anchor] of [["macCard", "install-mac"], ["iosCard", "install-ios"], ["windowsCard", "install-windows"], ["androidCard", "install-android"]]) {
    assert.match(downloadPage, new RegExp(`id="${id}"`));
    assert.match(downloadPage, new RegExp(`<section class="chapter(?: chapter--reverse)?" id="${anchor}"`));
    assert.match(downloadPage, new RegExp(`href="#${anchor}"`));
  }
  assert.match(downloadPage, /aria-label="Choose a platform"/);
  assert.match(downloadPage, /id="iosBtn"/);
  assert.match(downloadPage, /id="androidBtn"[^>]*href="\/downloads\/seven\.apk"/);
  assert.match(responseHeaders, /\/download\.html\s+Cache-Control: no-store, no-cache, must-revalidate/);
});

test("refreshing the download page clears a stale platform anchor and returns to the top", () => {
  const refreshHandler = downloadPage.match(/<script id="reset-scroll-on-refresh">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(refreshHandler, "the early refresh handler runs before the page can restore an anchor");
  assert.match(refreshHandler, /navigationEntry\.type === "reload"/);
  assert.match(refreshHandler, /history\.scrollRestoration = "manual"/);
  assert.match(refreshHandler, /history\.replaceState\(history\.state, "", location\.pathname \+ location\.search\)/);
  assert.match(refreshHandler, /window\.scrollTo\(0, 0\)/);
  assert.match(refreshHandler, /history\.scrollRestoration = previousScrollRestoration/);
});

test("the install story uses a restrained brand mark and lightweight app screenshots", () => {
  assert.match(downloadPage, /rel="icon" type="image\/png" sizes="64x64" href="\/assets\/favicon-64\.png\?v=2"/);
  assert.match(downloadPage, /rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png"/);
  assert.doesNotMatch(downloadPage, /href="\/icon\.svg" type="image\/svg\+xml"/);
  assert.doesNotMatch(downloadPage, /is-recommended|desktop-card|class="btn secondary"|function recommend/);
  assert.doesNotMatch(downloadPage, /class="(?:install-note|visual-caption)"/);
  assert.doesNotMatch(downloadPage, /Universal app · macOS 13 or later|For the app-style install, use Safari|64-bit installer ·|APK · Android may ask/);
  assert.match(downloadPage, /If asked, install <a href="https:\/\/developer\.microsoft\.com\/microsoft-edge\/webview2\/"[^>]*>WebView2 Runtime<\/a>/);
  assert.match(downloadPage, /seven-wordmark-download\.webp/);
  assert.ok(fs.statSync(path.join(repository, "Web/assets/seven-wordmark-download.webp")).size < 20_000);
  for (const screenshot of ["install-home-desktop.webp", "install-movies-desktop.webp", "install-series-desktop.webp", "install-home-mobile.webp", "install-movies-mobile.webp", "install-series-mobile.webp"]) {
    assert.ok(fs.statSync(path.join(repository, "Web/assets", screenshot)).size < 60_000, `${screenshot} stays lightweight`);
    assert.match(downloadPage, new RegExp(screenshot));
  }

  for (const id of ["macCard", "iosCard", "windowsCard", "androidCard"]) {
    const card = downloadPage.match(new RegExp(`<article class="platform-card" id="${id}">([\\s\\S]*?)<\\/article>`));
    assert.ok(card, `${id} uses the shared platform card`);
    assert.match(card[1], /class="platform-badge"/);
    assert.match(card[1], /class="btn"/);
    assert.doesNotMatch(card[1], /class="btn secondary"/);
  }
});

test("the installation chapters flow without large enclosing cards", () => {
  const continuousStyles = downloadPage.slice(downloadPage.indexOf("/* Keep the installation story continuous"));
  assert.match(continuousStyles, /\.hero\{[^}]*border:0[^}]*border-radius:0[^}]*box-shadow:none/);
  assert.match(continuousStyles, /\.platform-card\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(continuousStyles, /\.platform-link\{[^}]*border:1px solid #[\da-f]{6,8}[^}]*border-radius:14px[^}]*background:linear-gradient/);
  assert.match(continuousStyles, /\.platform-link:hover\{[^}]*translateY\(-3px\)[^}]*box-shadow:/);
  assert.match(continuousStyles, /\.platform-link:focus-visible\{outline:2px solid/);
  assert.match(continuousStyles, /\.platform-link\{[^}]*min-height:62px[^}]*border-radius:12px/);
  assert.match(continuousStyles, /\.chapter\+\.chapter\{border-top:0\}/);
});

test("the long-form install page keeps motion accessible and every platform install working", () => {
  assert.match(downloadPage, /<title>Install SEVEN — Your stories, on every screen<\/title>/);
  assert.match(downloadPage, /id="pageTitle">Good stories,<br><span>one tap away\.<\/span>/);
  assert.match(downloadPage, /@keyframes hero-drift/);
  assert.match(downloadPage, /@keyframes phone-drift/);
  assert.match(downloadPage, /@keyframes note-drift/);
  assert.match(downloadPage, /IntersectionObserver/);
  assert.equal((downloadPage.match(/class="chapter-visual(?: chapter-phone-wrap)? reveal"/g) ?? []).length, 4, "all four device previews reveal on scroll");
  assert.match(downloadPage, /chapter-visual\.reveal:not\(\.is-visible\) \.chapter-laptop\{[^}]*translate:0 34px[^}]*scale:\.96[^}]*filter:blur/);
  assert.match(downloadPage, /chapter-visual\.reveal:not\(\.is-visible\) \.chapter-phone\{[^}]*scale:\.92[^}]*filter:blur/);
  assert.match(downloadPage, /\.chapter-laptop\{--preview-y:-5deg;--preview-x:2deg;transform:perspective\(1400px\) rotateY\(var\(--preview-y\)\) rotateX\(var\(--preview-x\)\)\}/);
  assert.match(downloadPage, /chapter-visual\.reveal:not\(\.is-visible\) \.chapter-laptop\{--preview-y:-31deg;--preview-x:10deg/);
  assert.match(downloadPage, /chapter-visual\.reveal:not\(\.is-visible\) \.chapter-phone\{--preview-y:-27deg;--preview-z:5deg/);
  assert.match(downloadPage, /\.motion-ready \.chapter-visual\.reveal\.is-visible \.chapter-laptop:after,[\s\S]*?animation:preview-sheen 1\.15s/);
  assert.match(downloadPage, /@keyframes preview-sheen\{0%\{opacity:0;transform:translateX\(-125%\)\}[\s\S]*?100%\{opacity:0;transform:translateX\(125%\)\}\}/);
  assert.match(downloadPage, /chapter-visual\.reveal\.is-visible \.device\{transition-delay:\.12s\}/);
  assert.match(downloadPage, /chapter-visual\.reveal \.device\{opacity:1!important;translate:0 0!important;scale:1!important;filter:none!important;transition:none!important\}\.motion-ready \.chapter-visual\.reveal \.device:after\{animation:none!important;opacity:0!important;transform:none!important/);
  assert.match(downloadPage, /scroll-behavior:smooth/);
  assert.match(downloadPage, /prefers-reduced-motion\s*:\s*reduce/);
  assert.doesNotMatch(downloadPage, /qrserver\.com|id="qrImage"/);

  for (const id of ["macCard", "iosCard", "windowsCard", "androidCard"]) {
    const card = downloadPage.match(new RegExp(`<article class="platform-card" id="${id}">([\\s\\S]*?)<\\/article>`));
    assert.ok(card, `${id} remains available`);
    const action = card[1].match(/<(?:a|button) class="btn"[\s\S]*?<\/(?:a|button)>/)?.[0];
    assert.ok(action, `${id} keeps its install action`);
    const visibleLabel = action.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]*>/g, "").trim();
    assert.equal(visibleLabel, "Install SEVEN", `${id} uses the shared install label`);
    assert.match(action, /aria-label="Install SEVEN on /);
  }

  assert.match(downloadPage, /androidButton\.setAttribute\("aria-label", "Install SEVEN on Android is temporarily unavailable"\)/);
  assert.match(downloadPage, /window\.location\.assign\(appUrl\)/);
  assert.match(downloadPage, /if \(!response\.ok\) throw new Error\("Android install unavailable"\)/);
  assert.match(downloadPage, /Install SEVEN/);
  assert.doesNotMatch(downloadPage, /Download for Mac|Install on Windows|Download APK/);
});

test("the desktop wrapper confines embedded navigation to SEVEN and opens web links externally", () => {
  assert.match(desktopHost, /target\.Scheme\.Equals\(Uri\.UriSchemeHttps/);
  assert.match(desktopHost, /target\.IdnHost\.Equals\(AppHost/);
  assert.match(desktopHost, /OpenExternal\(target\)/);
  assert.match(macHost, /navigationAction\.targetFrame\?\.isMainFrame != false/);
  assert.match(macHost, /url\.host\?\.lowercased\(\) == sevenHost/);
  assert.match(macHost, /NSWorkspace\.shared\.open\(url\)/);
});

test("the Windows wrapper uses a compact custom title bar with working window controls", () => {
  assert.match(windowsChrome, /WindowStyle="None" ResizeMode="CanResize"/);
  assert.match(windowsChrome, /<shell:WindowChrome CaptionHeight="42"/);
  assert.match(windowsChrome, /shell:WindowChrome\.IsHitTestVisibleInChrome="True"/);
  const titleBar = windowsChrome.match(/<Border Grid\.Row="0"[\s\S]*?<\/Border>/)?.[0];
  assert.ok(titleBar, "the custom title bar exists");
  assert.equal((titleBar.match(/<Button\b/g) ?? []).length, 3, "the title bar contains only three window controls");
  assert.doesNotMatch(titleBar, /<Image\b|<TextBlock\b|Back_Click|Forward_Click|Reload_Click|OpenInBrowser_Click/);
  assert.match(windowsChrome, /Click="Minimize_Click"/);
  assert.match(windowsChrome, /Click="MaximizeRestore_Click"/);
  assert.match(windowsChrome, /Click="Close_Click"/);
  assert.match(windowsChrome, /StateChanged="Window_StateChanged"/);
  assert.match(windowsChrome, /<RowDefinition Height="42"/);
  assert.match(desktopHost, /SystemCommands\.MinimizeWindow\(this\)/);
  assert.match(desktopHost, /SystemCommands\.RestoreWindow\(this\)/);
  assert.match(desktopHost, /SystemCommands\.MaximizeWindow\(this\)/);
  assert.match(desktopHost, /MonitorFromWindow\(windowHandle, MonitorDefaultToNearest\)/);
  assert.match(desktopHost, /SetWindowPosNoSize \| SetWindowPosNoZOrder \| SetWindowPosNoActivate/);
  assert.match(windowsChrome, /WindowStartupLocation="Manual"/);
  assert.match(windowsChrome, /Closing="Window_Closing"/);
  assert.match(desktopHost, /SystemParameters\.WorkArea/);
  assert.match(desktopHost, /SystemParameters\.VirtualScreenWidth/);
  assert.match(desktopHost, /window-placement\.json/);
  assert.match(desktopHost, /LocationChanged \+=/);
  assert.match(desktopHost, /SizeChanged \+=/);
  assert.match(desktopHost, /JsonSerializer\.Serialize\(placement\)/);
  assert.match(desktopHost, /Close_Click\(object sender, RoutedEventArgs e\) => Close\(\)/);
});
