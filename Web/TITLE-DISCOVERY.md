# Collections and related titles

Movie details show a collection entry when TMDB supplies `belongs_to_collection`
and at least two titles remain after the active profile's restrictions. Open it
to browse the collection, filter watched/unwatched films, reverse release order,
and open the next unwatched released film. Large collections show 20 films at a
time. The original order numbers do not change when filtering or sorting.

Movie **and** series details include **More like this**. Recommendations are
preferred; TMDB's genre/keyword-based similar results provide additional choices.
Results are deduplicated and omit the current title, known collection siblings,
future/undated releases, and titles excluded by the profile's existing filters.
Six cards appear initially; Show more adds six, fetching further metadata pages
when necessary. Both sources retry failed pages without skipping them. Empty or
unavailable results never prevent the title itself from opening.

## Boundaries

- Collection membership comes from TMDB, not title-name guessing. TMDB movie
  collections do not represent every shared universe or TV crossover. TV details
  get related shows, not invented movie/TV franchise groupings.
- Order means **release order**, not a claimed chronological story order.
  Undated films stay last even in newest-first view.
- Release dates are metadata, not a guarantee that an embedded source can play
  a film. Future/undated collection entries are labelled, excluded from progress
  totals and never chosen as the next film. Opening a card opens its details,
  not its player. No new autoplay or play overlays are added.
- Progress reads the active profile's existing saved progress; collections do
  not write progress or manufacture watch time. A watched record or >=90%
  progress counts as watched, matching the rest of the app. Guests see their
  own device-local progress only. Watchlist saves remain account-only and
  profile-scoped, using the existing mutation/rollback handling.
- Private progress and bookmarks are not cached with metadata. Public metadata
  is cached in memory for 15 minutes (48 entries), keyed by language, endpoint
  and parameters. Failed, malformed and timed-out responses are retryable.
- Late responses only paint the same title/profile/account/language view. Route
  snapshots retain collection filters, loaded results, and scroll positions for
  normal back/forward navigation. There are no startup-animation changes.

## Implementation and checks

- `title-discovery.js`: normalization, ordering, progress summaries, related
  filtering, bounded metadata cache and independent-source pagination.
- `title-discovery-ui.js`: scoped DOM enhancement, collection route, localised
  English/French/Arabic controls, loading/retry/empty states.
- `title-discovery.css`: isolated layout, two-column phone grids, poster aspect
  ratios, keyboard focus and reduced-motion support.
- Both API proxies allow numeric `collection/{id}`, `movie/{id}/similar`, and
  `tv/{id}/similar`; arbitrary TMDB routes remain blocked.
- Version 370 installs the new assets in the service-worker shell. No database
  migration or native-wrapper rebuild is needed.

Run `node --test Web/tests/*.test.js` from the repository root. Browser QA covers
1440px desktop, 768px tablet, 390px and 320px phones: collection navigation,
profile isolation, watchlist changes, TV-only suggestions, back restoration,
failed-request recovery and responses arriving after leaving the page.

The optional browser suite is `node Web/qa/title-discovery.cjs` (requires
Playwright and Chrome; `SEVEN_PLAYWRIGHT_PATH` can point to an existing Playwright
module). It uses a local fixture API and real public poster metadata. All account
calls are fixtures. `SEVEN_LIVE=1` checks the deployed frontend instead, still
intercepting **all** account/API calls so it cannot change production accounts.
It also exercises 20/40/53-film pagination, completed collections, untrusted
metadata escaping, French/Arabic labels and title restrictions. Screenshots are
written to the operating system's temporary directory.

Live smoke test: open John Wick (TMDB 245891), open **John Wick Collection**,
check release order and progress, filter and bookmark a film, open it and go
back. Open Breaking Bad (TMDB 1396) to check series suggestions. Actual titles
and collection membership can change when TMDB metadata changes.
