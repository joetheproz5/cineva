package com.example.cineva

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject

private const val TMDB_SERIES_ID = "71712"
private val BACKGROUND = Color(0xFF071018)
private val PANEL = Color(0xFF0E171C)
private val ACCENT = Color(0xFFD1FF47)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme(colorScheme = darkColorScheme(primary = ACCENT, background = BACKGROUND, surface = PANEL)) { CinevaApp() } }
    }
}

@Composable
private fun CinevaApp() {
    var selectedEpisode by remember { mutableStateOf<Episode?>(null) }
    if (selectedEpisode == null) CatalogScreen { selectedEpisode = it } else PlayerScreen(selectedEpisode!!) { selectedEpisode = null }
}

@Composable
private fun CatalogScreen(onPlay: (Episode) -> Unit) {
    val episodes = remember { (1..6).map { Episode(1, it, listOf("Burnt Food", "Mount Rushmore", "Oliver", "Pipes", "Point Three Percent", "Not Fake")[it - 1]) } }
    LazyColumn(modifier = Modifier.fillMaxSize().background(BACKGROUND).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("CINEVA", style = MaterialTheme.typography.titleMedium, color = ACCENT); Spacer(Modifier.height(10.dp)); Text("The Good Doctor", style = MaterialTheme.typography.displaySmall); Text("A brilliant mind. An extraordinary journey.", color = Color.LightGray) }
        item { Button(onClick = { onPlay(episodes.first()) }, colors = ButtonDefaults.buttonColors(containerColor = ACCENT, contentColor = Color.Black)) { Text("Play") } }
        item { Text("Season 1", style = MaterialTheme.typography.titleLarge) }
        items(episodes.size) { index -> val episode = episodes[index]; Card(modifier = Modifier.fillMaxWidth().clickable { onPlay(episode) }, colors = CardDefaults.cardColors(containerColor = PANEL)) { Column(Modifier.padding(16.dp)) { Text(episode.code + "  " + episode.title, style = MaterialTheme.typography.titleMedium); Text("43 min", style = MaterialTheme.typography.labelSmall, color = Color.LightGray); Text("Open this episode in the authorized player.", color = Color.LightGray) } } }
    }
}

@Composable
private fun PlayerScreen(episode: Episode, onBack: () -> Unit) {
    var progress by remember { mutableStateOf(0.0) }
    val playerUrl = remember(episode) { embedUrl(episode, 0.0) }
    Column(Modifier.fillMaxSize().background(BACKGROUND)) {
        VidkingWebPlayer(playerUrl) { event -> progress = event.currentTime }
        Column(Modifier.padding(20.dp)) { Text(episode.code, color = ACCENT); Text(episode.title, style = MaterialTheme.typography.headlineMedium); Text("Progress: ${progress.toInt()} seconds", color = Color.LightGray); TextButton(onClick = onBack) { Text("Back to episodes") } }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun VidkingWebPlayer(url: String, onEvent: (PlayerEvent) -> Unit) {
    val context = LocalContext.current
    AndroidView(factory = {
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            addJavascriptInterface(PlayerBridge(onEvent), "CinevaBridge")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, finishedUrl: String) {
                    view.evaluateJavascript("window.addEventListener('message', function(e) { try { CinevaBridge.receive(typeof e.data === 'string' ? e.data : JSON.stringify(e.data)); } catch (_) {} });", null)
                }
            }
            loadUrl(url)
        }
    }, update = { if (it.url != url) it.loadUrl(url) }, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f))
}

private fun embedUrl(episode: Episode, progress: Double): String = "https://www.vidking.net/embed/tv/$TMDB_SERIES_ID/${episode.season}/${episode.number}?color=d1ff47&autoPlay=true&nextEpisode=true&episodeSelector=true&progress=${progress.toInt()}"
private data class Episode(val season: Int, val number: Int, val title: String) { val code get() = "S%02dE%02d".format(season, number) }
private data class PlayerEvent(val event: String, val currentTime: Double, val duration: Double)
private class PlayerBridge(private val onEvent: (PlayerEvent) -> Unit) {
    private val mainHandler = Handler(Looper.getMainLooper())
    @JavascriptInterface fun receive(payload: String) { runCatching { JSONObject(payload).let { root -> if (root.optString("type") == "PLAYER_EVENT") root.getJSONObject("data").let { PlayerEvent(it.optString("event"), it.optDouble("currentTime"), it.optDouble("duration")) } else null } }.getOrNull()?.let { event -> mainHandler.post { onEvent(event) } } }
}
