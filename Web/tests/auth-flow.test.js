const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(web, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(web, "auth.css"), "utf8");
const showAuthStart = app.indexOf("function showAuth(");
const showAuthEnd = app.indexOf("\nfunction showChangePassword(", showAuthStart);
const authMarkup = app.slice(showAuthStart, showAuthEnd);
const submitStart = app.indexOf("async function submitAuth(");
const submitEnd = app.indexOf("\nfunction renderProfileStats(", submitStart);
const submitAuth = app.slice(submitStart, submitEnd);

test("sign-in and sign-up forms expose loading and animated success states accessibly", () => {
  assert.match(authMarkup, /class="auth-content"/);
  assert.match(authMarkup, /class="auth-success-stage" role="status" aria-live="polite"/);
  assert.match(authMarkup, /data-auth-success-title/);
  assert.match(authMarkup, /data-auth-success-copy/);
  assert.match(authMarkup, /data-pending-login hidden/);
  assert.doesNotMatch(authMarkup, /auth-success-mark|<svg/);
  assert.match(submitAuth, /formElement\.classList\.add\("auth-submitting"\)/);
  assert.match(submitAuth, /submit\.setAttribute\("aria-busy", "true"\)/);
  assert.match(styles, /\.auth-submit\[aria-busy="true"\]::before[^}]*animation: auth-spinner/);
  assert.match(styles, /\.auth-flow\.auth-success \.auth-content[^}]*filter: blur\(9px\)/);
  assert.match(styles, /\.auth-flow\.auth-success \{[^}]*border-color: #303030;[^}]*linear-gradient\(150deg, #171717, #0d0d0d\)/);
  assert.doesNotMatch(styles, /auth-success-mark|90e7bd|117,225,179/);
});

test("successful authentication animates before opening the profile selector", () => {
  const success = submitAuth.indexOf("await showAuthSuccess(formElement");
  const profileSelector = submitAuth.indexOf('state.route = "profiles"');
  assert.ok(success >= 0);
  assert.ok(profileSelector > success);
  assert.ok(submitAuth.indexOf("render();", profileSelector) > profileSelector);
  assert.match(submitAuth, /Signed in successfully/);
  assert.match(submitAuth, /Account created/);
});

test("signup only leaves the auth form after resolving a signed-in user", () => {
  assert.match(submitAuth, /if \(!state\.user\?\.id\) throw new Error\("Your account was created/);
  assert.ok(submitAuth.indexOf('state.route = "onboarding"') > submitAuth.indexOf("if (!state.user?.id)"));
  assert.ok(submitAuth.indexOf("render();") > submitAuth.indexOf('state.route = "onboarding"'));
  assert.doesNotMatch(submitAuth, /document\.querySelector\("\.modal"\)\?\.remove\(\)/);
});

test("signup skips email verification when Supabase returns a session", () => {
  assert.match(submitAuth, /if \(create && !data\.session\?\.access_token && data\.user\)/);
  assert.match(submitAuth, /persistSession\(data\.session, Date\.now\(\)\)/);
  assert.doesNotMatch(submitAuth, /Account created\. Verify your email before signing in\./);
});

test("signup stays on a verification state until the confirmation redirect arrives", () => {
  assert.match(submitAuth, /if \(create && !data\.session\?\.access_token && data\.user\)/);
  assert.match(submitAuth, /localStorage\.setItem\(PENDING_EMAIL_VERIFICATION_KEY/);
  assert.match(submitAuth, /showAuthPending\(pending\.email, pending\)/);
  assert.match(app, /async function consumeEmailVerificationRedirect\(\)/);
  assert.match(app, /verified\?\.email\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(app, /Email verified successfully\. Sign in to continue\./);
  assert.match(styles, /\.auth-flow\.auth-waiting \.auth-success-stage::before/);
  assert.doesNotMatch(submitAuth, /\/api\/auth\/login/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.auth-flow/);
  assert.match(app, /data-pending-login/);
  assert.match(app, /localStorage\.removeItem\(PENDING_EMAIL_VERIFICATION_KEY\);\s*state\.pendingEmailVerification = null;\s*showAuth\("login", "Sign in to finish setting up your account\."/);
});
