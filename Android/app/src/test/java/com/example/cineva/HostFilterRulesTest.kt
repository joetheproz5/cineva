package com.example.cineva

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HostFilterRulesTest {
    @Test
    fun blocksExactDomainsAndTheirSubdomainsButNotLookalikes() {
        val rules = HostFilterRules.fromFilterText("||ads.example.com^\n")

        assertTrue(rules.blocks("ads.example.com"))
        assertTrue(rules.blocks("cdn.ads.example.com"))
        assertFalse(rules.blocks("notads.example.com"))
        assertFalse(rules.blocks("example.com"))
    }

    @Test
    fun exceptionsOverrideParentBlockRules() {
        val rules = HostFilterRules.fromFilterText(
            "||example.com^\n@@||player.example.com^\n",
        )

        assertTrue(rules.blocks("ads.example.com"))
        assertFalse(rules.blocks("player.example.com"))
        assertFalse(rules.blocks("cdn.player.example.com"))
    }

    @Test
    fun ignoresScopedAndPathRulesInsteadOfOverblockingTheirWholeDomain() {
        val rules = HostFilterRules.fromFilterText(
            "||ads.example.com/banner.js\n" +
                "||scoped.example.com^$domain=example.org\n" +
                "@@||scoped-exception.example.com^$script\n",
        )

        assertFalse(rules.blocks("ads.example.com"))
        assertFalse(rules.blocks("scoped.example.com"))
        assertFalse(rules.blocks("scoped-exception.example.com"))
    }

    @Test
    fun knownAppAndCatalogServicesAreNeverBlocked() {
        val rules = HostFilterRules.fromFilterText(
            "||pages.dev^\n||tmdb.org^\n||themoviedb.org^\n",
        )

        assertFalse(rules.blocks("seven-9fm.pages.dev"))
        assertFalse(rules.blocks("image.tmdb.org"))
        assertFalse(rules.blocks("api.themoviedb.org"))
    }

    @Test
    fun rejectsMalformedDomainsAndBadfilterRules() {
        val rules = HostFilterRules.fromFilterText(
            "||-bad.example^\n||bad..example^\n||disabled.example^$badfilter\n||ok.example^\n",
        )

        assertFalse(rules.blocks("-bad.example"))
        assertFalse(rules.blocks("bad..example"))
        assertFalse(rules.blocks("disabled.example"))
        assertTrue(rules.blocks("ok.example"))
    }
}
