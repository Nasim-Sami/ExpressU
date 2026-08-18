package com.expressu

import android.os.Bundle
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity

class GamesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_games)

        val webView = findViewById<WebView>(R.id.webview_games)
        webView.settings.javaScriptEnabled = true
        // Placeholder: load local or remote games. For now load a simple about:blank
        webView.loadData("<html><body><h2>Games placeholder</h2><p>Copy game assets into app assets and load here.</p></body></html>", "text/html", "utf-8")
    }
}
