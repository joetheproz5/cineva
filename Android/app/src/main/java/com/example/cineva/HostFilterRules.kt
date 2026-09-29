package com.example.cineva

/**
 * The deliberately small, predictable part of Adblock Plus syntax used by the
 * AdGuard DNS filter: exact domain rules (||domain^) and their exceptions.
 * Unsupported/path-scoped rules are ignored rather than guessed at.
 */
internal class HostFilterRules private constructor(
    private val blockedDomains: Set<String>,
    private val exceptionDomains: Set<String>,
) {
    val blockedDomainCount: Int get() = blockedDomains.size

    fun blocks(host: String): Boolean {
        val normalizedHost = host.trim().trimEnd('.').lowercase()
        if (!isValidDomain(normalizedHost)) return false
        if (matchesDomainOrParent(ALWAYS_ALLOWED_DOMAINS, normalizedHost)) return false
        if (matchesDomainOrParent(exceptionDomains, normalizedHost)) return false
        return matchesDomainOrParent(blockedDomains, normalizedHost)
    }

    fun mergedWith(other: HostFilterRules): HostFilterRules = HostFilterRules(
        blockedDomains = blockedDomains + other.blockedDomains,
        exceptionDomains = exceptionDomains + other.exceptionDomains,
    )

    companion object {
        private val ALWAYS_ALLOWED_DOMAINS = setOf(
            "seven-9fm.pages.dev",
            "api.themoviedb.org",
            "image.tmdb.org",
        )

        fun fromSeedDomains(text: String): HostFilterRules {
            val domains = text.lineSequence()
                .map { it.substringBefore('#').trim().lowercase() }
                .filter(::isValidDomain)
                .toSet()
            return HostFilterRules(domains, emptySet())
        }

        fun fromFilterText(text: String): HostFilterRules {
            val blocked = HashSet<String>()
            val exceptions = HashSet<String>()

            text.lineSequence().forEach { rawLine ->
                val line = rawLine.trim().removePrefix("\uFEFF")
                if (line.isEmpty() || line.startsWith('!') || line.startsWith('#')) return@forEach

                val isException = line.startsWith("@@")
                val rule = if (isException) line.substring(2) else line
                if (!rule.startsWith("||")) return@forEach

                val separator = rule.indexOf('^', startIndex = 2)
                if (separator < 0) return@forEach
                val domain = rule.substring(2, separator).lowercase()
                if (!isValidDomain(domain)) return@forEach

                val suffix = rule.substring(separator + 1)
                if (suffix.isNotEmpty()) {
                    if (!suffix.startsWith('$')) return@forEach
                    val options = suffix.substring(1).split(',').map { it.trim().lowercase() }
                    // These options change which site or resource type a rule applies to.
                    // We cannot safely infer that context from a host-only WebView callback.
                    if (options.any { it.startsWith("domain=") || it.startsWith("~domain=") }) return@forEach
                    if (options.any { it == "badfilter" }) return@forEach
                    if (isException && options.any { it !in setOf("important", "all") }) return@forEach
                    if (!isException && options.any { it !in setOf("important", "third-party", "~third-party") }) return@forEach
                }

                if (isException) exceptions += domain else blocked += domain
            }

            return HostFilterRules(blocked, exceptions)
        }

        private fun matchesDomainOrParent(domains: Set<String>, host: String): Boolean {
            var candidate = host
            while (true) {
                if (candidate in domains) return true
                val firstDot = candidate.indexOf('.')
                if (firstDot < 0) return false
                candidate = candidate.substring(firstDot + 1)
            }
        }

        private fun isValidDomain(domain: String): Boolean {
            if (domain.length !in 3..253 || '.' !in domain) return false
            return domain.split('.').all { label ->
                label.length in 1..63 &&
                    label.first().isLetterOrDigit() &&
                    label.last().isLetterOrDigit() &&
                    label.all { it.isLetterOrDigit() || it == '-' }
            }
        }
    }
}
