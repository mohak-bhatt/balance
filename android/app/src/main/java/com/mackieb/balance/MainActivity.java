package com.mackieb.balance;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        enableTransparentSystemBars();
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
        getBridge().getWebView().setScrollbarFadingEnabled(true);
        enableTransparentSystemBars();

        // Request notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        enableTransparentSystemBars();
    }

    private void enableTransparentSystemBars() {
        EdgeToEdge.enable(
            this,
            SystemBarStyle.dark(Color.TRANSPARENT),
            SystemBarStyle.dark(Color.TRANSPARENT)
        );
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().setNavigationBarDividerColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setFitsSystemWindows(false);
            contentView.setPadding(0, 0, 0, 0);
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, insets) -> {
                view.setPadding(0, 0, 0, 0);
                return WindowInsetsCompat.CONSUMED;
            });
        }
        WebView webView = getBridge() != null ? getBridge().getWebView() : findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) {
            webView.setFitsSystemWindows(false);
            webView.setPadding(0, 0, 0, 0);
            ViewGroup.LayoutParams layoutParams = webView.getLayoutParams();
            if (layoutParams != null) {
                layoutParams.width = ViewGroup.LayoutParams.MATCH_PARENT;
                layoutParams.height = ViewGroup.LayoutParams.MATCH_PARENT;
                webView.setLayoutParams(layoutParams);
            }
            ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
                view.setPadding(0, 0, 0, 0);
                return WindowInsetsCompat.CONSUMED;
            });
        }
    }
}
