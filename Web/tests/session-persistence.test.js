const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appPath = path.resolve(__dirname, "../app.js");
const app = fs.readFileSync(appPath, "utf8");
const blockStart = app.indexOf("function readStoredSession()");
const blockEnd = app.indexOf("\nasync function restoreSession()", blockStart);
const sessionFunctions = app.slice(blockStart, blockEnd);

function makeSession(refreshToken, expiresAt, startedAt = Date.now() - 60_000) {
  return { access_token:`access-${refreshToken}`, refresh_token:refreshToken, expires_at:expiresAt, expires_in:3600, seven_started_at:startedAt, user:{ id:"member-1" } };
}

function createContext({ session, localAPI, lockRequest } = {}) {
  const values = new Map([["cineva.supabase.session", JSON.stringify(session)]]);
  const state = { session, user:session?.user || null, accountProgress:[], pendingProgress:null, progressTimer:null };
  const navigator = { locks:{ request:lockRequest || ((_name, _options, callback) => callback()) } };
  const context = {
    SESSION_KEY:"cineva.supabase.session",
    ACCOUNT_OWNER_KEY:"seven.account.owner",
    MY_LIST_KEY:"seven.my-list",
    SESSION_REFRESH_LOCK:"seven-auth-session-refresh",
    state,
    window:{ addEventListener(){} },
    navigator,
    playbackWatch:{ sample:null, buffered:0, bufferType:null, accessToken:null, timer:null },
    localStorage:{ getItem:key => values.get(key) || null, setItem:(key, value) => values.set(key, value), removeItem:key => values.delete(key) },
    sessionStorage:{ removeItem(){} },
    localAPI:localAPI || (async () => { throw new Error("Unexpected auth request"); }),
    flushWatchTypeChange(){},
    flushWatchTime(){},
    reportAccountVisit(){},
    clearTimeout,
    setTimeout:() => 1,
    Date,
    Math
  };
  vm.createContext(context);
  vm.runInContext(`let sessionRefreshPromise;\n${sessionFunctions}`, context);
  return { context, state, values };
}

test("the client lets the auth provider decide session lifetime instead of enforcing a 30-day cutoff", async () => {
  const now = Date.now(), startedAt = now - 90 * 24 * 60 * 60 * 1000;
  const initial = makeSession("old-but-valid", Math.floor(now / 1000) + 60, startedAt);
  let authCalls = 0;
  const { context } = createContext({
    session:initial,
    localAPI:async () => { authCalls++; return { session:makeSession("renewed", Math.floor(Date.now() / 1000) + 3600, startedAt) }; }
  });
  const result = await context.refreshSession();
  assert.equal(authCalls, 1);
  assert.equal(result.refresh_token, "renewed");
  assert.doesNotMatch(app, /SESSION_MAX_AGE|sessionExpired\(/);
});

test("simultaneous refreshes in one tab share a single one-use refresh request", async () => {
  const now = Date.now(), initial = makeSession("refresh-1", Math.floor(now / 1000) + 60);
  let release, lockCalls = 0, authCalls = 0;
  const lockGate = new Promise(resolve => { release = resolve; });
  const { context, state } = createContext({
    session:initial,
    lockRequest:(_name, _options, callback) => { lockCalls++; return lockGate.then(callback); },
    localAPI:async () => { authCalls++; return { session:makeSession("refresh-2", Math.floor(Date.now() / 1000) + 3600, initial.seven_started_at) }; }
  });

  const first = context.refreshSession(), second = context.refreshSession();
  assert.equal(lockCalls, 1);
  release();
  const [left, right] = await Promise.all([first, second]);
  assert.equal(authCalls, 1);
  assert.equal(left.refresh_token, "refresh-2");
  assert.equal(right.refresh_token, "refresh-2");
  assert.equal(state.session.refresh_token, "refresh-2");
});

test("a tab adopts a newer session written while it waits for the cross-tab lock", async () => {
  const now = Date.now(), initial = makeSession("refresh-old", Math.floor(now / 1000) + 300);
  const renewed = makeSession("refresh-new", Math.floor(now / 1000) + 3600, initial.seven_started_at);
  let release, authCalls = 0;
  const lockGate = new Promise(resolve => { release = resolve; });
  const { context, state, values } = createContext({
    session:initial,
    lockRequest:(_name, _options, callback) => lockGate.then(callback),
    localAPI:async () => { authCalls++; throw new Error("Should reuse the other tab's refreshed session"); }
  });

  const refresh = context.refreshSession();
  values.set("cineva.supabase.session", JSON.stringify(renewed));
  release();
  const result = await refresh;
  assert.equal(authCalls, 0);
  assert.equal(result.refresh_token, "refresh-new");
  assert.equal(state.session.access_token, "access-refresh-new");
});
