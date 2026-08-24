package com.example.cineva

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
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
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

private const val APP_URL = "https://seven-9fm.pages.dev/"
private const val APP_HOST = "seven-9fm.pages.dev"

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var refreshLayout: SwipeRefreshLayout
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var fullScreenContainer: FrameLayout? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var offline = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        fullScreenContainer = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        root.addView(fullScreenContainer, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            setBackgroundColor(Color.BLACK)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (url.host == APP_HOST || url.host?.endsWith(".pages.dev") == true) return false
                    return runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)); true }.getOrDefault(false)
                }
                override fun onPageFinished(view: WebView, finishedUrl: String) {
                    offline = finishedUrl.startsWith("file://")
                    refreshLayout.isRefreshing = false
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) {
                        offline = true
                        view.loadUrl("file:///android_asset/offline.html")
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    if (customView != null) { callback.onCustomViewHidden(); return }
                    customView = view
                    customViewCallback = callback
                    fullScreenContainer?.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
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
            loadUrl(APP_URL)
        }

        refreshLayout = SwipeRefreshLayout(this).apply {
            setOnRefreshListener {
                if (offline) web.loadUrl(APP_URL) else web.reload()
            }
            addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        root.addView(refreshLayout, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
    }

    private fun exitFullscreen() {
        fullScreenContainer?.removeAllViews()
        fullScreenContainer?.visibility = View.GONE
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
        web.destroy()
        super.onDestroy()
    }
}
