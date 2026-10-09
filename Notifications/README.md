# SEVEN release alerts

This Cloudflare Worker stores opt-in, device-level release reminders and sends Web Push notifications from an hourly Cron Trigger. It stores only a hash of a random device token, the browser's push subscription, and titles the person explicitly asked to follow; it does not store account emails or viewing history.

Release dates are checked against SEVEN's TMDB proxy before a notification is sent. They are TMDB-listed release dates, not a promise that a title is available on a streaming service.

## Deploy

```powershell
npm ci
npx wrangler d1 migrations apply seven-release-reminders --remote
npx wrangler deploy
```

`VAPID_PRIVATE_KEY` is a Cloudflare Worker secret. Never add its value to this repository. `VAPID_PUBLIC_KEY` is public and must be the matching key for the secret. The current production Worker is configured in `wrangler.jsonc`; its hourly trigger is deployed with the Worker.

If the VAPID key pair is rotated, update the secret and public variable together. Existing browser subscriptions must be recreated with the new public key.
