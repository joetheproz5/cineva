# Home spotlight transitions

The Home carousel uses `hero-spotlight.js` and scoped `hero-spotlight.css`.
The startup ident, profile selector and profile-to-Home handoff are unchanged.

- The first image must load and finish decoding before the first title appears.
- The next image is prefetched while the current title is visible. The initial
  pair also starts warming as soon as catalog metadata is available.
- Switching waits for decoded artwork, then moves the outgoing and incoming
  background/copy horizontally together over 620ms. The arrows remain stationary
  and keep keyboard focus. The old upward copy entrance is disabled only here.
- A slow network leaves the current complete slide visible. State, actions and
  the counter switch together only when the target artwork is ready.
- The poster and then the local still placeholder are fallbacks if the backdrop
  fails. Fallbacks must also decode before display. Each image attempt times out
  after 15 seconds; failures are retryable.
- The decoded image promise cache holds at most five URLs. Autoplay does not
  advance while loading/transitioning or while the document is hidden. Rapid
  manual clicks are last-request-wins, including wraparound and previous.
- Navigation, a new Home render, profile changes or a replaced catalog invalidate
  pending changes. Outgoing controls are inert and hidden from assistive tech.
- Reduced-motion users get an immediate atomic switch after decoding, without
  a different loading path or a text-before-artwork flash.

Tests: `node --test Web/tests/*.test.js`.
Optional browser suite: `node Web/qa/hero-spotlight.cjs` with Playwright and Chrome
available (`SEVEN_PLAYWRIGHT_PATH` may point to an installed module). The suite
holds image responses until explicitly released, tests image errors/fallbacks,
rapid requests and leaving Home, and checks desktop/mobile/reduced-motion modes.
All APIs and images are intercepted fixtures, also with `SEVEN_LIVE=1` against
the deployed frontend. No real accounts or playback sessions are modified.
