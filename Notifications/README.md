# SEVEN release alerts

This Cloudflare Worker stores opt-in, device-level release reminders and sends Web Push notifications from an hourly Cron Trigger. It stores only a hash of a random device token, the browser's push subscription, and titles the person explicitly asked to follow; it does not store account emails or viewing history.

Release dates are checked against SEVEN's TMDB proxy before a notification is sent. They are TMDB-listed release dates, not a promise that a title is available on a streaming service.

Episode alerts follow series saved to the active profile's Watchlist or Favourites. A separate follow set replaces the active profile on each device; profile switches and sign-out clear the old set. Only a hash of the account/profile scope is stored, never email addresses, account IDs or episode viewing progress. Up to 80 shows can receive alerts per device. Watching progress still stays in the account's profile-scoped storage.

Opting in records the current latest episode as a baseline, so it does not send historical alerts. The hourly job checks TMDB for a newer released episode or season premiere, retries unsuccessful sends and removes expired push subscriptions. Metadata is checked at least daily for announced future dates, and within six hours when a date is not announced; scheduled dates are rechecked on release day. Alerts describe listed dates, not confirmed player availability.

Migration `0002_episode_follows.sql` is additive and must be applied before deploying the updated Worker. Follow-set revisions prevent a slow old profile request from replacing a newer one. Existing one-time movie reminders remain independent.

## Deploy

```powershell
npm ci
npx wrangler d1 migrations apply seven-release-reminders --remote
npx wrangler deploy
```

`VAPID_PRIVATE_KEY` is a Cloudflare Worker secret. Never add its value to this repository. `VAPID_PUBLIC_KEY` is public and must be the matching key for the secret. The current production Worker is configured in `wrangler.jsonc`; its hourly trigger is deployed with the Worker.

If the VAPID key pair is rotated, update the secret and public variable together. Existing browser subscriptions must be recreated with the new public key.
