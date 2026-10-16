# Reliable account settings sync (build 378)

## Data path

`saveAccount` delegates to `Web/settings-sync.js` through `settings-sync-ui.js`. An owner-scoped local outbox is written before a request is sent. Brief pending-enqueue backups protect saves interrupted while waiting for a browser queue lock. Confirmed snapshots have a separate cache so stale offline Auth metadata cannot replace a newer acknowledged save.

The UI distinguishes **Saved**, **Saving**, **Waiting to sync**, **Review changes**, and authentication/storage errors. Offline/transient failures retry with bounded exponential backoff (2–60 seconds), immediately on connectivity return, and on foregrounding. Visible clients check for remote updates once per minute. Failed or malformed responses never count as acknowledgement. Password changes and parent-code verification remain immediate credential operations, not queued requests. Plain passwords, codes and session tokens are excluded from the outbox; existing profile-lock hashes remain account settings.

Active profile selection stays local to each device. All synced records and retries are scoped to the authenticated account, including across account switches. Settings saves do not replace a playing iframe or erase text in an open form.

## Conflict handling

The canonical account remains `auth.users.raw_user_meta_data.seven_account`; revision is `seven_settings_revision`. `public.seven_settings_sync` locks the authenticated user's Auth row and compares the expected revision within the same transaction. A stale revision returns HTTP 409 with the current account/revision and does not write.

The client performs a three-way merge against its acknowledged baseline. Different fields/profiles merge automatically; title restrictions, likes and hidden titles merge by title identity. Same-field edits, deletion versus editing, and profile-limit collisions remain queued until the user chooses a value. Open settings forms retain their original baseline so a background refresh cannot silently change what their submission overwrites. Existing watch-stat reconciliation is reused; screen-time usage retains the larger value for the same day, and recent searches merge additions/removals without preference-conflict prompts.

There is deliberately no fallback to unconditional full-document writes. Legacy clients receive `SETTINGS_CLIENT_UPDATE_REQUIRED` and must load the updated web build. Password updates ignore any accompanying stale account snapshot and update credentials only. Favourites, Watchlist membership and playback progress use their existing separate endpoints; this change is not a new offline queue for those systems. Feedback Undo now uses the durable settings path and may complete locally while sync is pending.

## Migration and checks

- Migration: `Web/supabase-settings-sync.sql`. Installs one own-account RPC, grants execution only to authenticated users, rejects anonymous sessions, and validates bounded, unique profile IDs. No existing account settings are modified merely by installing it.
- Applied to the configured Supabase project before web deployment.
- Real SQL regression: `Web/qa/settings-sync-transaction.sql`. Uses a disposable fixture entirely inside a rolled-back transaction; verifies revisions, stale-write rejection, rebasing, validation and account isolation. The live SQL editor returned PASS.

```powershell
node --test Web/tests/*.test.js
$env:SEVEN_PLAYWRIGHT_PATH='C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node Web/qa/settings-sync.cjs
node Web/qa/settings-ui.cjs
node Web/qa/undo-actions.cjs
```

The browser regression uses independent sessions sharing an isolated CAS backend, checks desktop/mobile layouts, offline close/reopen recovery, retries, two-device conflicts, untouched fields in stale forms, changes during a request, and credential exclusion. All API calls are fixture-intercepted even with `SEVEN_LIVE=1`; no real user account is changed by browser QA. The migration and rollback SQL test were verified separately against real PostgreSQL.
