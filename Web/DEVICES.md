# Manage devices

Account-wide sessions, available only from the main profile's Security page.
The canonical main profile is `main`, or the first existing profile for legacy
accounts without that ID. Renaming it does not change access; it cannot be
deleted through the editor. Other profiles do not display the action, and the
server requires the main-profile identifier plus account-password verification.
Profiles share one account login; profile selection itself is not a separate
authentication principal. Knowing the account password allows an owner to switch
to the main profile and manage that account's sessions.

The password is verified by Supabase, never persisted or logged. Verification's
temporary session is immediately logged out. A domain-separated HMAC capability
grants five minutes of management access, bound to the verified account, current
Supabase session and main profile. It exists only in page memory and is discarded
on profile changes and sign-out. Actions require an explicit confirmation.

## Database

Run `Web/supabase-devices.sql` in the project's SQL Editor before deploying. It
is transactional/idempotent. It adds a private activity table referencing real
`auth.sessions`, three **service_role-only** RPCs and a session-existence helper
used by restrictive RLS policies on account-data tables. No existing sessions
are revoked by applying the migration. Existing session/refresh-token deletion
cascades are used for real revocation. No access/refresh tokens, passwords, IP
addresses or location data are stored in the new table or returned by the API.

The existing Cloudflare server bindings `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (or the legacy service-role key)
and `SEVEN_DASHBOARD_SECRET` are required. Private keys stay server-side. Both
Cloudflare and the local server use `shared/devices.mjs`.

## Enforcement

Every authenticated account API, Watch Party API and `/auth/user` call checks
the actual session. Refresh responses are checked too, including requests from
older clients. Database RLS also rejects revoked JWTs for account tables even
before their JWT expiration. Device activity writes are throttled to once per
minute (or a changed browser identity). The current app checks every minute
while visible, and on focus/returning to the foreground. It removes the signed-in
UI/player on revocation and propagates sign-out between browser tabs.

An offline device cannot be contacted immediately; it loses server access and
signs out locally on its next successful online check. Older cached app shells
may not update their UI until refresh, but refresh tokens and protected data
access are still revoked. This does not remove notifications already delivered
by the operating system or control unrelated third-party player sessions.

Legacy sessions without browser details remain listed as unrecognized rather
than inventing a device or location. New login/refresh requests forward the
actual User-Agent to Supabase; active app checks fill the private activity table.
Each browser/PWA login is a session, not a claim to uniquely identify a physical
piece of hardware. Up to 100 most-recent sessions are displayed; sign out all
others revokes every other session, not just displayed rows.

If the migration is absent, management reports setup required while existing
account APIs continue to function during rollout. Once installed, verification
errors fail closed with a retriable 503, not a silent bypass or a forced logout
on a network outage. Expired JWTs are not mislabeled as remote revocations.
Verified JWT identities (only their account UUID) are cached for up to 30 seconds
inside a bounded server-instance cache; the database session-existence check is
never cached. This limits auth-server traffic without delaying revocations.
