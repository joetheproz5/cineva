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
  assert.match(submitAuth, /formElement\.classList\.add\("auth-submitting"\)/);
  assert.match(submitAuth, /submit\.setAttribute\("aria-busy", "true"\)/);
  assert.match(styles, /\.auth-submit\[aria-busy="true"\]::before[^}]*animation: auth-spinner/);
  assert.match(styles, /\.auth-flow\.auth-success \.auth-content[^}]*filter: blur\(9px\)/);
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

test("signup is ready for email verification without attempting a premature login", () => {
  assert.match(submitAuth, /if \(create && !data\.session\?\.access_token && data\.user\)/);
  assert.match(submitAuth, /showAuthSuccess\(formElement, "Check your email"/);
  assert.match(submitAuth, /showAuth\("login", "Account created\. Verify your email before signing in\."\)/);
  assert.doesNotMatch(submitAuth, /\/api\/auth\/login/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.auth-flow/);
});
