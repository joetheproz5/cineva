const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const handlerURL = pathToFileURL(path.resolve(__dirname, "../../functions/api/[[path]].js")).href;

async function signupWithMockResponse(upstreamBody) {
  const originalFetch = global.fetch;
  let upstreamRequest;
  global.fetch = async (url, options) => {
    upstreamRequest = { url:String(url), options };
    return Response.json(upstreamBody);
  };
  try {
    const { onRequest } = await import(handlerURL);
    const response = await onRequest({
      request:new Request("https://seven.example/api/auth/signup", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ email:"new@example.com", password:"not-a-real-password", displayName:"New viewer" }) }),
      env:{ SUPABASE_URL:"https://project.example", SUPABASE_PUBLISHABLE_KEY:"public-key" },
      params:{ path:"auth/signup" }
    });
    return { upstreamRequest, body:await response.json() };
  } finally { global.fetch = originalFetch; }
}

test("the deployed Pages signup handler marks onboarding and normalizes Supabase's top-level session", async () => {
  const result = await signupWithMockResponse({
    access_token:"access-token",
    refresh_token:"refresh-token",
    expires_in:3600,
    user:{ id:"new-user", email:"new@example.com" }
  });
  const sent = JSON.parse(result.upstreamRequest.options.body);

  assert.equal(result.upstreamRequest.url, "https://project.example/auth/v1/signup");
  assert.deepEqual(sent.data.seven_account, { onboardingComplete:false, onboardingStep:1 });
  assert.equal(result.body.session.access_token, "access-token");
  assert.ok(result.body.session.expires_at > 0);
  assert.equal(result.body.user.id, "new-user");
});

test("the Pages signup handler does not invent a session when Auth requires confirmation", async () => {
  const user = { id:"pending-user", email:"pending@example.com" };
  const result = await signupWithMockResponse({ user });
  assert.deepEqual(result.body, { user });
  assert.equal(result.body.session, undefined);
});
