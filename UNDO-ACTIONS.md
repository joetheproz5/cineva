# Quick Undo

An eight-second, in-memory Undo is available after removing a Watchlist/Favourites title, choosing “Not for me”, manually marking an episode watched/unwatched, and bulk history changes/imports. It is not offered for automatic playback updates, account/profile deletion, sign-out or security changes.

`Web/undo-actions.js` owns a bounded queue of five recent actions. Navigation keeps the toast; switching accounts/profiles or signing out clears it. Hover and keyboard focus pause expiry. A newer action on the same item invalidates the old Undo. Duplicate Undo clicks are blocked. Failed restores remain retryable instead of claiming success.

Saved-title restores use the existing authenticated, profile-scoped list endpoints and retain the original saved date/order. The optional `added_at` field is validated and does not change requests that omit it. Feedback Undo restores the affected hidden/liked records, including the prior like removed by “Not for me”; other titles are retained. Episode/bulk Undo uses the existing progress-batch compare-and-swap endpoint and skips newer local playback. Equivalent timestamp formats are compared by instant, not JSON text. The original bulk-history Undo remains available beyond the quick toast.

The toast lives outside the route container, above mobile navigation and safe-area insets. It does not restart a playing iframe or replace settings/password forms. It uses text-only status messages, keyboard-operable buttons and reduced-motion support. No database migration or third-party package is required.

Build 378: feedback Undo uses the settings outbox. A locally completed restore can show **Waiting to sync** and retry automatically after a network failure; list/progress endpoint failures still retain their direct retry behavior.

## Verification

```powershell
node --test Web/tests/*.test.js
$env:SEVEN_PLAYWRIGHT_PATH='C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node Web/qa/undo-actions.cjs
```

The browser suite covers desktop, phone and narrow/reduced-motion layouts, original-save and restore failures, retries, successive actions, hidden/liked restoration, progress conflicts, guest/local Undo, the episode modal, preserving a playing iframe and a password form, profile isolation and mobile toast placement. All API calls use fixtures even with `SEVEN_LIVE=1`; no real user data is changed by QA.
