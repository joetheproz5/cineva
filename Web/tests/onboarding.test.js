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
  assert.match(onboarding, /function finishOnboarding\(\)[\s\S]*profile\.name = String\(draft\.name\)/);
  assert.match(onboarding, /profile\.avatar = isProfileAvatar\(draft\.avatar\)/);
  assert.match(onboarding, /async function saveOnboardingProfile\(\)[\s\S]*await persistOnboardingAccount\(\); state\.onboardingStep = 2/);
});

test("taste answers change the actual For You requests and current-mix option preserves existing behavior", () => {
  assert.match(onboarding, /Pick up to three\. We’ll use them to shape your For You page\./);
  assert.match(onboarding, /Keep SEVEN’s current mix/);
  assert.match(onboarding, /draft\.favoriteGenres = \[\]; draft\.contentMix = "both"; draft\.familySafe = false/);
  assert.match(onboarding, /favoriteGenres:draft\.favoriteGenres\.slice\(0,3\)/);
  assert.match(onboarding, /contentMix:\["movies","series"\]\.includes\(draft\.contentMix\) \? draft\.contentMix : "both"/);
  assert.match(onboarding, /localAPI\("\/api\/account\/settings"/);
  assert.match(forYou, /currentPreferences\(\)/);
  assert.match(forYou, /with_genres:movieGenre/);
  assert.match(forYou, /with_genres:seriesGenre/);
  assert.match(forYou, /preferences\.contentMix !== "series"/);
  assert.match(forYou, /preferences\.contentMix !== "movies"/);
  assert.match(forYou, /if \(familySafe\)/);
  assert.match(onboarding, /\[\["both","Movies & series"\],\["movies","Movies only"\],\["series","Series only"\]\]/);
});

test("profile-picker avatar focus and borders use SEVEN red rather than the browser blue ring", () => {
  assert.match(styles, /\.profile-gate \.profile-choice \.profile-avatar \{ border-color: #b9141d/);
  assert.match(styles, /\.profile-gate \.profile-choice:focus-visible \.profile-avatar \{ border-color: #fff; box-shadow: 0 0 0 2px #d3131c/);
});
