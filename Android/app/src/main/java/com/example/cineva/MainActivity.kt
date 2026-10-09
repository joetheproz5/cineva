package com.example.cineva

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import java.net.URI
import java.net.URLDecoder

private const val APP_URL = "https://seven-9fm.pages.dev/"
private const val APP_HOST = "seven-9fm.pages.dev"

private fun isTrustedAppURL(uri: Uri): Boolean = uri.scheme == "https" && uri.host == APP_HOST

internal fun supportedAppLink(rawUrl: String?): String? {
    val uri = rawUrl?.let { runCatching { URI(it) }.getOrNull() } ?: return null
    if (!uri.scheme.equals("https", ignoreCase = true)
        || uri.host?.equals(APP_HOST, ignoreCase = true) != true
        || uri.rawUserInfo != null
        || uri.port != -1 && uri.port != 443
        || uri.rawPath.orEmpty() !in setOf("", "/")
    ) return null

    val params = mutableMapOf<String, MutableList<String>>()
    try {
        uri.rawQuery.orEmpty().split('&').filter(String::isNotEmpty).forEach { pair ->
            val parts = pair.split('=', limit = 2)
            val key = URLDecoder.decode(parts[0], "UTF-8")
            val value = URLDecoder.decode(parts.getOrElse(1) { "" }, "UTF-8")
            params.getOrPut(key) { mutableListOf() }.add(value)
        }
    } catch (_: IllegalArgumentException) {
        return null
    }

    val titles = params["title"].orEmpty()
    if (titles.size != 1 || !titles.single().matches(Regex("^(movie:\\d+|tv:\\d+(?::\\d+:\\d+)?)$"))) return null

    val watchCodes = params["watch"].orEmpty()
    if (watchCodes.size > 1 || watchCodes.any { !it.matches(Regex("^[A-Z0-9]{4,8}$")) }) return null
    return uri.toString()
}

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var fullscreenPreviousOrientation: Int? = null
    private var fullScreenContainer: FrameLayout? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AndroidAdBlocker.initialize(applicationContext)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        fullScreenContainer = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        root.addView(fullScreenContainer, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportMultipleWindows(false)
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            setBackgroundColor(Color.BLACK)
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return if (AndroidAdBlocker.shouldBlock(request)) AndroidAdBlocker.blockedResponse() else null
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (isTrustedAppURL(url)) return false
                    // The app shell must never navigate to an advertiser's page. Cross-origin player
                    // requests remain inside their iframe; top-level popups and redirects are cancelled.
                    return request.isForMainFrame
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) {
                        view.loadUrl("file:///android_asset/offline.html")
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                    // Do not create WebViews for window.open()/target=_blank advertising popups.
                    return false
                }
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    if (customView != null) { callback.onCustomViewHidden(); return }
                    customView = view
                    customViewCallback = callback
                    fullscreenPreviousOrientation = requestedOrientation
                    // Video fullscreen should rotate even when Android's system auto-rotate
                    // switch is off. Restore the app's prior orientation when fullscreen ends.
                    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    fullScreenContainer?.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                    // The browser view is normally the top-most child in the root. Bring the
                    // server-provided full-screen view above it before showing it; otherwise
                    // WebView acknowledges the request but the player remains visible.
                    web.visibility = View.GONE
                    fullScreenContainer?.bringToFront()
                    fullScreenContainer?.visibility = View.VISIBLE
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
                override fun onHideCustomView() { exitFullscreen() }
                override fun onShowFileChooser(webView: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = callback
                    return runCatching { startActivityForResult(params.createIntent(), 1001); true }.getOrDefault(false)
                }
            }
            loadUrl(supportedAppLink(intent?.dataString) ?: APP_URL)
        }

        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        supportedAppLink(intent.dataString)?.let { web.loadUrl(it) }
    }

    private fun exitFullscreen() {
        fullScreenContainer?.removeAllViews()
        fullScreenContainer?.visibility = View.GONE
        web.visibility = View.VISIBLE
        customView = null
        val callback = customViewCallback
        customViewCallback = null
        fullscreenPreviousOrientation?.let { requestedOrientation = it }
        fullscreenPreviousOrientation = null
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        callback?.onCustomViewHidden()
    }

    override fun onBackPressed() {
        when {
            customView != null -> exitFullscreen()
            web.canGoBack() -> web.goBack()
            else -> super.onBackPressed()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == 1001) {
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            fileChooserCallback?.onReceiveValue(results)
            fileChooserCallback = null
        } else super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        if (customView != null) exitFullscreen()
        web.destroy()
        super.onDestroy()
    }
}
