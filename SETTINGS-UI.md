# Inner settings layout

`Web/settings-ui.js` enhances the existing profile settings after their handlers are bound. `Web/settings-ui.css` is scoped to those pages and their dialogs; it does not alter startup, profile selection, player or account APIs.

- Profile PIN, title blocking and the optional DNS guide use native keyboard-accessible disclosure rows. Parent access, password changes, device management and installation remain rows opening their existing forms/dialogs.
- Maturity, daily limit, language and player dropdowns stack below their labels at all widths. Kids off still means unrestricted 18+, with screen-time controls disabled.
- Parent/code/password dialogs share the settings styling, masked code fields, close labels, keyboard focus containment and Escape dismissal. Device management retains its own busy-aware focus handling and main-profile authorization.
- Blocking/unblocking titles preserves other unsaved form choices in memory only, scoped to the account, profile and category. PINs, passwords, codes and files are never retained by this draft helper. Search Enter does not submit Family settings; stale search responses cannot replace newer ones.
- Destructive actions use cancellable dialogs. Navigation invalidates a pending confirmation. Clear history targets the profile being edited, not a different active profile. Password update confirmation sits above mobile navigation.
- Existing save, password verification, parent authorization and device/session endpoints remain authoritative. Browser fixtures do not prove real backend authentication; the backend is unchanged.

## Checks

```powershell
node --test Web/tests/*.test.js
$env:SEVEN_PLAYWRIGHT_PATH='C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node Web/qa/settings-ui.cjs
```

Browser coverage: 1440, 768, 390 and 320px; all settings categories; stacked dropdowns and overflow; parent setup/mismatch; PIN set/cancel; password mismatch/server failure/retry/success; title block/unblock and unsaved drafts; destructive confirmation cancellation; profile-scoped history; device main-profile visibility; installation dialog. API calls are intercepted with isolated fixtures, including when `SEVEN_LIVE=1`. Screenshots are written to the system temporary directory.
