# Catch-up and history import

In **Watchlist → Up next → Episodes**, use **Catch up to an episode** or the
season watched/unwatched controls. Each operation has a preview before saving.
Catch-up includes regular episodes with a listed air date on/before today;
specials, undated and future episodes are excluded. Season controls can also
manage released specials when that season is selected. A save is limited to
1,000 episodes; for longer shows, catch up in stages.

**Import history** accepts Netflix's Title/Date viewing CSV, explicit-ID CSVs,
or JSON arrays containing `tmdb_id` (or `id`), `type` (`movie`/`tv`), and for
series `season`/`episode`. It supports up to 500 rows / 2 MB. Use the downloadable
CSV example for the exact column format. Netflix episode names are matched only
when unique; ambiguous titles or missing episode numbers require review. A row
can be deselected. Future, unavailable or unresolved entries cannot be saved.
Imported series are not automatically added to Watchlist; save a series there
to follow it in Up next. Dates, durations and elapsed time from the import file
are intentionally not used to manufacture watch hours or viewing streak dates.
The file is parsed locally; public title queries go to TMDB, and only confirmed
progress is sent to the account API. No paid AI service is used.

All changes are account-only and keyed by the active profile. Bulk upsert is one
PostgREST transaction with the user's JWT and existing playback-progress RLS;
it does not need a database migration or service-role credentials. Existing real
playback seconds are preserved when marking watched. New manual/imported marks
have zero playback seconds. Unwatching clears saved playback position, not the
separate accumulated watch-time ledger.

**Undo last change** restores the last bulk operation for that profile during
the current app session. New rows are deleted; prior rows are restored. Undo
uses server-side timestamp predicates, leaving subsequent playback or manual
changes untouched. Requests contain at most 20 entries (four concurrent upstream
requests); partial failures retain the remaining entries for another attempt.
Reloading the app clears the in-memory undo history. Individual episode toggles
keep their original behavior and do not replace the last bulk undo entry.

Tests: `node --test Web/tests/*.test.js`. The shared endpoint is mounted in both
Cloudflare Pages Functions and the local development server. Web-only changes
are served by the existing Windows/Android wrappers, without rebuilding their
installers. Service worker version: `seven-v366`.
