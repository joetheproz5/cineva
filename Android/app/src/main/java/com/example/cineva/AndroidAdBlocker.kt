package com.example.cineva

import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.GZIPInputStream

/** App-scoped WebView filtering. It never changes Android's system/network settings. */
internal object AndroidAdBlocker {
    private const val PREFS_NAME = "seven_ad_filter"
    private const val LAST_SUCCESSFUL_UPDATE = "last_successful_update"
    private const val LAST_ATTEMPTED_UPDATE = "last_attempted_update"
    private const val UPDATE_INTERVAL_MS = 30L * 24 * 60 * 60 * 1000
    private const val RETRY_INTERVAL_MS = 12L * 60 * 60 * 1000
    private const val MAX_REDIRECTS = 3
    private const val MAX_FILTER_BYTES = 8 * 1024 * 1024
    private const val MIN_FILTER_RULES = 10_000
    private const val FILTER_URL = "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt"
    private const val TAG = "SEVEN-AdBlock"

    private val initialized = AtomicBoolean(false)
    private val fallbackRules = AtomicReference(HostFilterRules.fromSeedDomains(""))
    private val rules = AtomicReference(fallbackRules.get())
    private val worker = Executors.newSingleThreadExecutor { task ->
        Thread(task, TAG).apply { isDaemon = true }
    }

    fun initialize(context: Context) {
        if (!initialized.compareAndSet(false, true)) return
        val appContext = context.applicationContext

        val seed = runCatching {
            appContext.assets.open("adblock/seed-hosts.txt").bufferedReader().use { it.readText() }
        }.getOrDefault("")
        val seedRules = HostFilterRules.fromSeedDomains(seed)
        fallbackRules.set(seedRules)
        rules.set(seedRules)

        worker.execute {
            val cacheFile = File(appContext.filesDir, "adblock/adguard-dns-filter.txt")
            val cachedText = runCatching {
                if (cacheFile.length() in 1..MAX_FILTER_BYTES.toLong()) cacheFile.readText() else ""
            }.getOrDefault("")
            val cachedRules = HostFilterRules.fromFilterText(cachedText)
            if (cachedRules.blockedDomainCount >= MIN_FILTER_RULES) {
                rules.set(fallbackRules.get().mergedWith(cachedRules))
            }

            val preferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            if (now - preferences.getLong(LAST_ATTEMPTED_UPDATE, 0L) < RETRY_INTERVAL_MS) return@execute
            if (now - preferences.getLong(LAST_SUCCESSFUL_UPDATE, 0L) < UPDATE_INTERVAL_MS) return@execute
            preferences.edit().putLong(LAST_ATTEMPTED_UPDATE, now).apply()

            runCatching {
                val downloadedText = downloadFilter(URL(FILTER_URL))
                val downloadedRules = HostFilterRules.fromFilterText(downloadedText)
                check(downloadedRules.blockedDomainCount >= MIN_FILTER_RULES) { "Ad filter list failed validation" }

                cacheFile.parentFile?.mkdirs()
                val temporaryFile = File(cacheFile.parentFile, "adguard-dns-filter.tmp")
                temporaryFile.writeText(downloadedText)
                if (cacheFile.exists() && !cacheFile.delete()) throw IOException("Cannot replace cached filter")
                if (!temporaryFile.renameTo(cacheFile)) throw IOException("Cannot save downloaded filter")

                // Replace the prior remote rules so domains removed upstream stop being blocked.
                rules.set(fallbackRules.get().mergedWith(downloadedRules))
                preferences.edit()
                    .putLong(LAST_SUCCESSFUL_UPDATE, System.currentTimeMillis())
                    .apply()
            }
        }
    }

    fun shouldBlock(request: WebResourceRequest): Boolean {
        if (request.isForMainFrame) return false
        val uri = request.url ?: return false
        if (uri.scheme != "https" && uri.scheme != "http") return false
        val host = uri.host ?: return false
        return rules.get().blocks(host)
    }

    fun blockedResponse(): WebResourceResponse = WebResourceResponse(
        "text/plain",
        "UTF-8",
        204,
        "No Content",
        mapOf("Cache-Control" to "no-store"),
        ByteArrayInputStream(ByteArray(0)),
    )

    private fun downloadFilter(startUrl: URL): String {
        var url = startUrl
        repeat(MAX_REDIRECTS + 1) {
            require(url.protocol.equals("https", ignoreCase = true)) { "Filter redirects must use HTTPS" }
            val connection = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 8_000
                readTimeout = 12_000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "text/plain")
                setRequestProperty("Accept-Encoding", "gzip")
                setRequestProperty("User-Agent", "SEVEN-Android/1 AdFilter")
            }

            try {
                val status = connection.responseCode
                if (status in 300..399) {
                    val location = connection.getHeaderField("Location") ?: throw IOException("Missing filter redirect")
                    url = URL(url, location)
                    return@repeat
                }
                if (status !in 200..299) throw IOException("Filter server returned HTTP $status")
                if (connection.contentLengthLong > MAX_FILTER_BYTES) throw IOException("Ad filter list is too large")

                val rawStream = connection.inputStream
                val input = if (connection.contentEncoding.equals("gzip", ignoreCase = true)) GZIPInputStream(rawStream) else rawStream
                val output = ByteArrayOutputStream()
                input.use { stream ->
                    val buffer = ByteArray(16 * 1024)
                    var total = 0
                    while (true) {
                        val read = stream.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_FILTER_BYTES) throw IOException("Ad filter list is too large")
                        output.write(buffer, 0, read)
                    }
                }
                return output.toString(Charsets.UTF_8.name())
            } finally {
                connection.disconnect()
            }
        }
        throw IOException("Too many redirects while downloading ad filter")
    }
}
