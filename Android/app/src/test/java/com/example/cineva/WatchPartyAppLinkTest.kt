package com.example.cineva

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WatchPartyAppLinkTest {
    @Test
    fun acceptsMovieAndEpisodeInviteLinks() {
        val movie = "https://seven-9fm.pages.dev/?watch=AB12CD&title=movie%3A550"
        val episode = "https://seven-9fm.pages.dev/?watch=AB12CD&title=tv%3A1396%3A1%3A3"

        assertEquals(movie, supportedAppLink(movie))
        assertEquals(episode, supportedAppLink(episode))
    }

    @Test
    fun acceptsStandaloneTitleDeepLinks() {
        val title = "https://seven-9fm.pages.dev/?title=movie%3A550"

        assertEquals(title, supportedAppLink(title))
    }

    @Test
    fun rejectsUntrustedOrMalformedLinks() {
        assertNull(supportedAppLink("https://example.com/?watch=AB12CD&title=movie%3A550"))
        assertNull(supportedAppLink("https://seven-9fm.pages.dev/not-the-app/?watch=AB12CD&title=movie%3A550"))
        assertNull(supportedAppLink("https://seven-9fm.pages.dev/?watch=AB12CD"))
        assertNull(supportedAppLink("https://seven-9fm.pages.dev/?watch=bad-code&title=movie%3A550"))
        assertNull(supportedAppLink("https://seven-9fm.pages.dev/?title=tv%3A1396%3A1"))
        assertNull(supportedAppLink("https://seven-9fm.pages.dev/?title=movie%3A550&title=movie%3A551"))
    }
}
