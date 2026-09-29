const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const server = fs.readFileSync(path.join(web, "server.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "auth.css"), "utf8");
const onboardingStart = app.indexOf("function renderOnboarding()");
const onboardingEnd = app.indexOf("function accountNavItem(", onboardingStart);
const onboarding = app.slice(onboardingStart, onboardingEnd);
const forYouStart = app.indexOf("async function openForYou()");
const forYouEnd = app.indexOf("function renderForYou()", forYouStart);
const forYou = app.slice(forYouStart, forYouEnd);

test("new accounts enter profile-first onboarding and existing accounts keep the profile picker", () => {
  assert.match(server, /seven_account:\{ onboardingComplete:false, onboardingStep:1 \}/);
  assert.match(app, /function needsFirstRunOnboarding\(\)[\s\S]*saved\.onboardingComplete === false[\s\S]*Date\.now\(\) - createdAt < 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(app, /if \(firstRun\) \{ beginOnboarding\(\); state\.route = "onboarding"; \}[\s\S]*else state\.route = "profiles"/);
  assert.match(app, /if \(state\.route === "onboarding" && state\.user\) return renderOnboarding\(\)/);
});

test("first step creates a named profile with an avatar before taste questions", () => {
  assert.ok(onboarding.indexOf("Let’s make this profile yours.") < onboarding.indexOf("02 / YOUR TASTE"));
  assert.match(onboarding, /data-onboarding-avatar/);
  assert.match(onboarding, /data-onboarding-upload/);
  assert.match(onboarding, /function finishOnboarding\(submitButton = null\)[\s\S]*profile\.name = String\(draft\.name\)/);
  assert.match(onboarding, /profile\.avatar = isProfileAvatar\(draft\.avatar\)/);
  assert.match(onboarding, /async function saveOnboardingProfile\(submitButton = null\)[\s\S]*await persistOnboardingAccount\(\); state\.onboardingStep = 2/);
});

test("genres, content mix, and family preferences each have a separate onboarding page", () => {
  assert.match(onboarding, /02 \/ YOUR TASTE[\s\S]*Pick up to three genres/);
  assert.match(onboarding, /03 \/ YOUR MIX[\s\S]*What would you like to browse/);
  assert.match(onboarding, /04 \/ CONTENT FILTER[\s\S]*Who’s watching/);
  assert.match(onboarding, /aria-valuemax="4" aria-valuenow="\$\{step\}"/);
  assert.match(app, /onboardingStep = Number\.isInteger\(savedStep\)[\s\S]*savedStep <= 4 \? savedStep : 1/);
  assert.match(onboarding, /async function saveOnboardingChoices\(nextStep, submitButton = null\)[\s\S]*state\.account\.onboardingStep = nextStep[\s\S]*await persistOnboardingAccount\(\); state\.onboardingStep = nextStep/);
  assert.match(onboarding, /data-next-step="\$\{nextStep\}"/);
  assert.match(onboarding, /state\.onboardingStep = Math\.max\(1, Number\(state\.onboardingStep \|\| 1\) - 1\)/);
  assert.equal((onboarding.match(/data-onboarding-default=/g) || []).length, 1);
  assert.match(onboarding, /defaultAction\("Keep current profile", 1\)/);
  assert.match(onboarding, /defaultAction\("No genre preference", 2\)/);
  assert.match(onboarding, /defaultAction\("Keep both", 3\)/);
  assert.match(onboarding, /defaultAction\("Show everything", 4\)/);
  assert.match(onboarding, /if \(step === 1\)[\s\S]*saveOnboardingProfile\(button\)[\s\S]*step === 2[\s\S]*saveOnboardingChoices\(3, button\)[\s\S]*step === 3[\s\S]*saveOnboardingChoices\(4, button\)[\s\S]*step === 4[\s\S]*finishOnboarding\(button\)/);
  assert.match(onboarding, /submit\.hasAttribute\("data-onboarding-default"\) \? "Saving…"/);
  assert.match(styles, /\.onboarding-actions-start \{ display: flex; min-width: 0; align-items: center;/);
  assert.match(styles, /\.onboarding-back \{[^}]*text-align: left;/);
  assert.match(styles, /\.onboarding-actions \{ display: flex; align-items: center; justify-content: space-between/);
  assert.match(styles, /\.onboarding-default-action \{ display: flex; min-height: 44px;[^}]*border: 1px solid/);
});

test("taste answers change the actual For You requests and each page can keep its own default", () => {
  assert.match(onboarding, /Pick up to three genres\. We’ll use them to shape your For You page\./);
  assert.match(onboarding, /draft\.favoriteGenres = \[\];\s*void saveOnboardingChoices\(3, button\)/);
  assert.match(onboarding, /draft\.contentMix = "both";\s*void saveOnboardingChoices\(4, button\)/);
  assert.match(onboarding, /draft\.familySafe = false;\s*void finishOnboarding\(button\)/);
  assert.match(onboarding, /favoriteGenres:draft\.favoriteGenres\.slice\(0,3\)/);
  assert.match(onboarding, /contentMix:\["movies","series"\]\.includes\(draft\.contentMix\) \? draft\.contentMix : "both"/);
  assert.match(onboarding, /localAPI\("\/api\/account\/settings"/);
  assert.match(forYou, /currentPreferences\(\)/);
  assert.match(forYou, /with_genres:movieGenre/);
  assert.match(forYou, /with_genres:seriesGenre/);
  assert.match(forYou, /preferences\.contentMix !== "series"/);
  assert.match(forYou, /preferences\.contentMix !== "movies"/);
  assert.match(forYou, /if \(familySafe\)/);
  assert.match(onboarding, /\[\["both","Movies & series","A balanced mix of films and series\."\],\["movies","Movies only","Keep your discovery focused on films\."\],\["series","Series only","Find your next series to settle into\."\]\]/);
  assert.match(onboarding, /data-onboarding-safe="true"/);
  assert.match(onboarding, /data-onboarding-safe="false"/);
  assert.doesNotMatch(onboarding, /Skip setup|data-onboarding-skip/);
});

test("changing profile choices updates only those controls instead of rebuilding the page", () => {
  assert.match(onboarding, /function updateOnboardingAvatarUI\(\)[\s\S]*button\.classList\.toggle\("selected", selected\)[\s\S]*preview\.innerHTML = profileAvatar/);
  assert.match(onboarding, /function updateOnboardingGenresUI\(\)[\s\S]*button\.disabled = draft\.favoriteGenres\.length >= 3 && !selected[\s\S]*count\.textContent/);
  assert.match(onboarding, /function updateOnboardingMixUI\(\)[\s\S]*button\.setAttribute\("aria-pressed", String\(selected\)\)/);
  assert.match(onboarding, /function updateOnboardingFamilyUI\(\)[\s\S]*button\.setAttribute\("aria-pressed", String\(selected\)\)/);
  assert.match(onboarding, /draft\.avatar = button\.dataset\.onboardingAvatar; updateOnboardingAvatarUI\(\)/);
  assert.match(onboarding, /draft\.favoriteGenres = \[\.\.\.selected\]; updateOnboardingGenresUI\(\)/);
  assert.match(onboarding, /draft\.contentMix = button\.dataset\.onboardingMix; updateOnboardingMixUI\(\)/);
  assert.match(onboarding, /draft\.familySafe = button\.dataset\.onboardingSafe === "true";[\s\S]*updateOnboardingFamilyUI\(\)/);
  assert.doesNotMatch(onboarding, /data-onboarding-avatar[\s\S]{0,180}renderOnboarding\(\)/);
});

test("profile-picker avatar focus and borders use SEVEN red rather than the browser blue ring", () => {
  assert.match(styles, /\.profile-gate \.profile-choice \.profile-avatar \{ border-color: #b9141d/);
  assert.match(styles, /\.profile-gate \.profile-choice:focus-visible \.profile-avatar \{ border-color: #fff; box-shadow: 0 0 0 2px #d3131c/);
});
