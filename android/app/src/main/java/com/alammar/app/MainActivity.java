package com.alammar.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.FrameLayout;

/**
 * Opens the store website full screen. Links to the store stay inside the app;
 * WhatsApp, phone, email and other websites open in their own apps. Supports
 * photo uploads (admin product form) and printing / saving the bill as PDF.
 */
public class MainActivity extends Activity {
    private static final int PICK_FILES = 41;

    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> pendingUpload;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setIndeterminate(false);
        progress.getProgressDrawable().setTint(getColor(R.color.brand));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3)));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); // the site is a JavaScript app
        s.setDomStorageEnabled(true); // keeps customers and admins signed in
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " AlAmmarApp/" + BuildConfig.FLAVOR);
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "AlAmmarApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (state != null) web.restoreState(state);
        else web.loadUrl(BuildConfig.START_URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != PICK_FILES || pendingUpload == null) {
            super.onActivityResult(request, result, data);
            return;
        }
        Uri[] picked = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                picked = new Uri[n];
                for (int i = 0; i < n; i++) picked[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                picked = new Uri[] {data.getData()};
            }
        }
        pendingUpload.onReceiveValue(picked);
        pendingUpload = null;
    }

    private boolean isStoreUrl(Uri uri) {
        return "https".equals(uri.getScheme()) && BuildConfig.SITE_HOST.equals(uri.getHost());
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // No app can open it (for example WhatsApp is not installed).
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showOffline() {
        String html = "<html><body style=\"font-family:sans-serif;background:#FAF9F6;color:#152d28;"
                + "display:flex;align-items:center;justify-content:center;height:90vh;text-align:center\">"
                + "<div><h2>No internet connection</h2><p>Please check your connection and try again.</p>"
                + "<button onclick=\"AlAmmarApp.retry()\" style=\"background:#174F42;color:#fff;border:0;"
                + "padding:14px 26px;border-radius:10px;font-size:16px\">Try again</button></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    /** Called from the page: the site's "Download bill" button uses window.print(). */
    private class Bridge {
        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter("Al Ammar bill");
                pm.print("Al Ammar bill", adapter,
                        new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> web.loadUrl(BuildConfig.START_URL));
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri uri = req.getUrl();
            if (isStoreUrl(uri)) return false;
            openOutside(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progress.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            // WebView has no print dialog of its own; route window.print() to Android's.
            view.evaluateJavascript(
                    "window.print=function(){AlAmmarApp.print()};", null);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) showOffline();
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int value) {
            progress.setProgress(value);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (pendingUpload != null) pendingUpload.onReceiveValue(null);
            pendingUpload = callback;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                    params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try {
                startActivityForResult(Intent.createChooser(pick, "Choose photos"), PICK_FILES);
            } catch (ActivityNotFoundException e) {
                pendingUpload = null;
                return false;
            }
            return true;
        }
    }
}
