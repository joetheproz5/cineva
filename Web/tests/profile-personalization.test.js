const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const migration = source.slice(source.indexOf("function migrateAccountTastePreferences"), source.indexOf("function hydrateAccount()"));
const preferences = source.slice(source.indexOf("function preferencesForProfile"), source.indexOf("function updateCurrentPreferences"));

test("legacy account taste choices migrate to the active profile and no longer leak to other profiles", () => {
  const context = {
    PROFILE_TASTE_KEYS:["favoriteGenres", "contentMix", "familySafe"],
    DEFAULT_PREFERENCES:{ favoriteGenres:[], contentMix:"both", familySafe:false, language:"English" },
    state:{ account:null },
    currentProfile:() => context.state.account.profiles.find(profile => profile.id === context.state.account.activeProfileId)
  };
  vm.createContext(context);
  vm.runInContext(`${migration}\n${preferences}`, context);

  const savedLegacy = { favoriteGenres:[28,18], contentMix:"movies", familySafe:true };
  const account = { activeProfileId:"main", preferences:{ ...savedLegacy, language:"French" }, profiles:[{ id:"main", name:"Main" }, { id:"second", name:"Second", preferences:{ favoriteGenres:[35], contentMix:"series", familySafe:false } }] };
  assert.equal(context.migrateAccountTastePreferences(savedLegacy, account), true);
  assert.deepEqual(JSON.parse(JSON.stringify(account.profiles[0].preferences)), savedLegacy);
  assert.deepEqual(JSON.parse(JSON.stringify(account.profiles[1].preferences)), { favoriteGenres:[35], contentMix:"series", familySafe:false });
  assert.deepEqual(JSON.parse(JSON.stringify(account.preferences)), { language:"French" });

  context.state.account = account;
  context.state.account.activeProfileId = "main";
  assert.deepEqual(Array.from(context.currentPreferences().favoriteGenres), [28,18]);
  context.state.account.activeProfileId = "second";
  assert.deepEqual(Array.from(context.currentPreferences().favoriteGenres), [35]);
  assert.equal(context.currentPreferences().contentMix, "series");
});
