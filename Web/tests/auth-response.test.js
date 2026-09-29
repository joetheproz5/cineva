const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeAuthResponse } = require("../auth-response");

test("signup responses with an access token become the session shape used by the app", () => {
  const result = normalizeAuthResponse("signup", {
    access_token:"access-token",
    refresh_token:"refresh-token",
    expires_in:3600,
    user:{ id:"user-1", email:"new@example.com" }
  }, 1_700_000_000_000);

  assert.equal(result.session.access_token, "access-token");
  assert.equal(result.session.expires_at, 1_700_003_600);
  assert.equal(result.user.id, "user-1");
});

test("signup without a session remains an unverified-user response", () => {
  const result = { user:{ id:"user-1", email:"new@example.com" } };
  assert.equal(normalizeAuthResponse("signup", result), result);
});

test("existing session-shaped login responses keep their session", () => {
  const session = { access_token:"access-token", refresh_token:"refresh-token", expires_at:1234, user:{ id:"user-1" } };
  const result = normalizeAuthResponse("login", { session, user:session.user }, 1_700_000_000_000);
  assert.equal(result.session.expires_at, 1234);
  assert.equal(result.user.id, "user-1");
});
