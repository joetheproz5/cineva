const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const css = fs.readFileSync(path.join(web, "settings-ui.css"), "utf8");
const index = fs.readFileSync(path.join(web, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(web, "service-worker.js"), "utf8");

test("Settings transitions are scoped to in-app Settings controls and use one shared timing config", () => {
  assert.match(app, /const SETTINGS_PAGE_TRANSITION = Object\.freeze\(/);
  assert.match(app, /phoneBreakpointPx:768/);
  assert.match(app, /phoneDurationMs:320/);
  assert.match(app, /desktopDurationMs:220/);
  assert.match(app, /desktopExitDurationMs:100/);
  assert.match(app, /safetyTimeoutMs:400/);
  assert.match(app, /settingsTransitionIsReduced\(\)[\s\S]*?SEVEN_NATIVE_ANIMATION_SCALE === 0/);
  assert.match(app, /control\.closest\("\.settings-screen, \.settings-subpage"\)/);
  assert.match(app, /restoreAppNavigation/);
  assert.match(app, /if \(inAppSettingsBack\) settingsTransitionIntent\.restoreScroll/);
  assert.match(app, /heading\.focus\(\{ preventScroll:true \}\)/);
  assert.match(app, /settingsTransitionAnnouncer\(\)\.textContent = title/);
  assert.match(app, /outgoing\.inert = true/);
  assert.match(app, /outgoing\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(app, /const scrim = phone && !reduced \? document\.createElement\("div"\) : null/);
  assert.match(css, /\.settings-screen h1\[tabindex="-1"\]:focus,[\s\S]*?\.settings-subpage h1\[tabindex="-1"\]:focus \{ outline:none; \}/);
});

test("Settings profile edits use the existing profile form in the Settings shell", () => {
  assert.match(app, /function profileEditorSettingsMarkup\(profile, canRemove, backLabel\)/);
  assert.match(app, /const full = profileEditorFormMarkup\(profile, false, canRemove\)/);
  assert.match(app, /profileEditorSettingsMarkup\(profile, canRemove, state\.profileFormReturnCategory/);
  assert.match(app, /previousSnapshot\.values\.profileDraft = active \? \{ \.\.\.active \}/);
  assert.match(app, /returnFromProfileEditor\(isNew \? "" : savedNotice\)/);
  assert.match(app, /profile-settings-edit-page/);
  assert.match(app, /data-profile-form-cancel data-settings-back/);
  assert.match(app, /state\.profileEditorIsNew = false/);
  assert.match(app, /const settingsEdit = !isNew && \["home", "profiles"\]/);
  assert.match(app, /if \(!settingsEdit\) \{[\s\S]{0,180}navigateBackInApp\(returnFromProfileEditor\)/);
});

test("last-row hairlines include single-row Settings surfaces, including Sign out", () => {
  assert.match(css, /profile-settings-signout > :last-child::after \{ display: none; \}/);
  assert.match(css, /settings-section-rows > :last-child::after/);
  assert.match(css, /profile-category-list > :last-child::after/);
});

test("the updated Settings assets are available to online and offline app loads", () => {
  for (const asset of ["settings-ui.css?v=9", "app.js?v=450"]) {
    assert.ok(index.includes(asset), `index.html includes ${asset}`);
    assert.ok(worker.includes(asset), `service worker includes ${asset}`);
  }
  assert.match(worker, /seven-v454/);
});
