# Profile age restrictions

Restricted profiles use actual **US classifications supplied by TMDB**, not a
title's genres, popularity, score, or `adult:false` flag. This is US policy, not
a claim that every country's ratings are interchangeable. PG and TV-PG are
parental-guidance categories, not guarantees that every child should watch them.

| Profile limit | Allowed movie classifications | Allowed TV classifications |
| --- | --- | --- |
| Kids | G, PG | TV-Y, TV-Y7, TV-Y7-FV, TV-G, TV-PG |
| 13+ | G, PG, PG-13 | Same as Kids (TV-14 is above 13) |
| 16+ | G, PG, PG-13 | Same as Kids plus TV-14 |
| Kids off / 18+ | No age restriction, including unrated | No age restriction, including unrated |

The existing parent-gated **Profile settings → Family controls** controls this.
Kids mode starts at Kids; valid parent-selected 13+/16+ values now persist and
take effect. Turning Kids off resets maturity to 18+ and disables the selector.
Legacy Kids profiles saved as 18+ normalize to Kids. Explicit blocked titles,
movie/series switches, and the separate family-safe/scary browsing preferences
remain independent; direct-search behavior for those optional genre preferences
is unchanged. Explicit title blocks and age limits never have a search exception.

## Metadata and failure policy

- Movies: `movie/{id}/release_dates`; TV: `tv/{id}/content_ratings`.
  Detail requests append those resources alongside existing credits/videos.
- Only US entries and a finite allowlist of known codes are accepted. If several
  US entries disagree, the strictest classification wins. Empty movie release
  entries do not override a valid code. Explicit NR/unknown codes, malformed
  responses, no US classification, and lookup failures do not grant access.
- Restricted catalog/search/related/collection responses wait for rating checks
  before their titles can render. Public filmographies/collections check up to
  200 identities per response; remaining unverified titles stay hidden. Saved
  views prime up to 1,000 identities; saved data is never deleted by filtering.
- Public ratings coalesce by movie/TV ID, with six concurrent lookups, a bounded
  2,000-entry memory cache, 24-hour rated TTL, one-hour unrated TTL and 30-second
  error TTL. Browser lookups time out after eight seconds. A circuit breaker
  avoids draining a large queue through repeated service timeouts. Retry clears
  the chosen title's error and permits another network attempt.
- No account tokens, history, profile preferences or private lists are sent to
  TMDB by the rating lookup. Requests contain public title IDs only. No database
  migration, paid AI service, or native installer rebuild is needed.
- Classification subresources are network-only in the service worker, preventing
  an indefinitely stale offline rating from granting access in a new session.

## Enforcement and boundaries

Home/spotlight, search and suggestions, mobile search, catalogs, For You,
collections/related titles, actor filmographies, Favourites, Watchlist, Continue
Watching, history, ratings/hidden-title pages and displayed stats titles apply
the same synchronous policy after metadata preparation. Sparse saved records
cannot approve themselves through a fabricated rating field. Cached tracker
rows are filtered again at display time; fetching followed shows remains possible
when their age metadata has not been loaded yet.

Movie/series detail rendering and player rendering each have a final gate.
Direct/deep links, resume/history actions and watch-party title changes cannot
create an embedded player through SEVEN for an unapproved title. Late title and
catalog responses cannot open on a different account/profile/content-policy scope.
Unknown direct links show a generic checking/retry screen without title artwork.
Detail information displays the actual code and `(US)`, or `Not rated`; the old
fabricated TV-14 fallback on unrated movies is removed.

TMDB is community-maintained metadata, not an independent verification of each
rating by SEVEN. TV ratings here apply to the series, not independently classified
episodes. These are controls in SEVEN's UI, not DRM or a system-wide parental
firewall: they cannot control unrelated websites, browser developer tools, or
navigation/advertisements inside a third-party provider's cross-origin player.
The existing parent access-code mechanism is preserved, not replaced.

## Verification and deployment

`node --test Web/tests/*.test.js`

`node Web/qa/age-ratings.cjs` (Playwright + Chrome; `SEVEN_PLAYWRIGHT_PATH` may
point to an installed module). `SEVEN_LIVE=1` runs against deployed frontend
assets; **every** API/player/image request still uses isolated fixtures, including
all account writes. Covers desktop/mobile, adult animation, TV-MA drama,
unrated titles, child/teen caps, collections, saved/history/resume/party routes,
retry recovery, standard-profile access and delayed cross-profile responses.

Real public metadata checks: Toy Story G, Bluey TV-Y; Sausage Party/John Wick R,
The Boys/South Park TV-MA. Recheck live values rather than assuming TMDB metadata
can never change. No production account mutations are needed to run this check.

References: [TMDB movie certifications](https://developer.themoviedb.org/reference/movie-release-dates),
[TMDB TV ratings](https://developer.themoviedb.org/reference/tv-series-content-ratings),
[MPA guide](https://www.filmratings.com/ratings-guide/),
[TV Parental Guidelines](https://tvguidelines.org/faqs.html).

App/service worker version: **375**. The startup ident/profile animations and
horizontal spotlight transition are unchanged.
