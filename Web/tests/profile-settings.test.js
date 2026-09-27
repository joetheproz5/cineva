const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "auth.css"), "utf8");
const homeSource = source.slice(source.indexOf("function profileCategoryRow("), source.indexOf("\nfunction profileSettingsDetail("));
const detailStart = source.indexOf("function profileSettingsDetail(");
const detailSource = source.slice(detailStart, source.indexOf("\nfunction renderProfileSettings()", detailStart));

function settingsContext() {
  const context = {
    state:{ profileSettingsNotice:"", account:{ profiles:[{ id:"main", name:"Joe" }] } },
    t:value => value,
    escapeHTML:value => String(value || "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" })[char]),
    profileAvatar:() => "<span class=\"profile-avatar\"></span>",
    PLAYER_PROVIDERS:["cinesrc", "vidfast", "multiembed", "vidsrc", "2embed"],
    accountAction:() => "",
    hiddenTitles:() => []
  };
  vm.createContext(context);
  vm.runInContext(`${homeSource}\n${detailSource}`, context);
  return context;
}

test("the redesigned settings hub keeps all seven working categories discoverable", () => {
  const context = settingsContext();
  const html = context.profileSettingsHome({ id:"main", name:"Joe", kids:false }, false);
  for (const category of ["profiles", "profile", "family", "playback", "language", "activity", "security"]) {
    assert.match(html, new RegExp(`data-profile-category="${category}"`));
  }
  assert.equal((html.match(/class="profile-settings-group"/g) || []).length, 3);
  assert.match(source, /profile-settings-topbar[\s\S]*?data-switch-profile/);
  assert.match(html, /data-profile-category="profile"/);
  assert.equal((html.match(/class="profile-category-icon"/g) || []).length, 7);
  assert.match(html, /class="profile-hub-edit" data-profile-category="profile"/);
});

test("the settings hub and details use spacious single-column layouts", () => {
  assert.match(styles, /\.profile-settings-redesign \.profile-settings-intro \{ display: block !important;/);
  assert.match(styles, /\.profile-settings-redesign \.profile-settings-groups \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles, /\.profile-settings-redesign #profile-settings-form:has\(\.family-controls\) \{ display: block; \}/);
  assert.match(styles, /\.profile-settings-redesign \.profile-mobile-row \{ min-height: 82px;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.profile-settings-redesign \.profile-settings-groups \{ gap: 13px; \}/);
});

test("every settings category uses a deliberate, responsive page-heading grid", () => {
  assert.match(source, /class="profile-settings-page-heading"><button class="profile-category-back"[\s\S]*?<div class="profile-settings-heading-copy"><span class="brand">\$\{t\("PROFILE SETTINGS"\)\}<\/span><h2>\$\{t\(titles\[category\]\)\}<\/h2><\/div><p>\$\{t\(descriptions\[category\]\)\}<\/p><\/header>/);
  assert.match(styles, /\.profile-settings-redesign \.profile-settings-page-heading \{ display: grid;[\s\S]*?grid-template-areas: "back back" "copy description";/);
  assert.match(styles, /\.profile-settings-redesign \.profile-settings-heading-copy \{ grid-area: copy;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?grid-template-areas: "back" "copy" "description";/);
});

test("playback and display pages render controls that the profile form persists", () => {
  const context = settingsContext();
  const profile = { id:"main", name:"Joe", preferences:{} };
  const playback = context.profileSettingsDetail(profile, "playback", {
    autoplayNext:true, introEnabled:false, autoplayPreviews:true, episodeAlerts:false, playerProvider:"vidfast"
  }, false);
  for (const setting of ["autoplayNext", "introEnabled", "autoplayPreviews", "episodeAlerts", "playerProvider"]) {
    assert.match(playback, new RegExp(`name="${setting}"`));
  }
  assert.match(playback, /value="vidfast" selected/);

  const display = context.profileSettingsDetail(profile, "language", {
    language:"French", moviesEnabled:false, seriesEnabled:true
  }, false);
  for (const setting of ["language", "moviesEnabled", "seriesEnabled"]) {
    assert.match(display, new RegExp(`name="${setting}"`));
  }
  assert.match(source, /\["maturity", "language", "playerProvider"\]/);
  assert.match(source, /"moviesEnabled", "seriesEnabled"\]/);
});

test("the startup intro honors the active profile preference before account defaults", () => {
  const introSource = source.match(/function launchIntroEnabled\(\) \{[^\n]+/)?.[0];
  assert.ok(introSource, "launchIntroEnabled should be available");
  const context = {
    ACCOUNT_KEY:"settings",
    localStorage:{ getItem:() => JSON.stringify({
      activeProfileId:"main",
      preferences:{ introEnabled:true },
      profiles:[{ id:"main", preferences:{ introEnabled:false } }]
    }) }
  };
  vm.createContext(context);
  vm.runInContext(introSource, context);
  assert.equal(context.launchIntroEnabled(), false);
});
