package ca.campusday.app;

import android.app.Activity;
import android.content.*;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** An offline Android host. Only packaged assets can run in the WebView. */
public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private boolean ready = false;
    private Uri pendingUri;
    private static final String ORIGIN = "https://app.campusday.local/";
    private static final int PICK_CALENDAR = 42;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16,20,18));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16,20,18));
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                root.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !"app.campusday.local".equals(uri.getHost())) return blocked();
                String path = uri.getPath();
                if (path == null || path.contains("..")) return blocked();
                if (path.equals("/")) path = "/index.html";
                String type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
                try { return new WebResourceResponse(type, "UTF-8", getAssets().open(path.substring(1))); }
                catch (IOException e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public void onPageFinished(WebView view, String url) {
                ready = true;
                if (pendingUri != null) { Uri uri = pendingUri; pendingUri = null; readCalendar(uri); }
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl(ORIGIN);
        handleIntent(getIntent());
    }
    private WebResourceResponse blocked() { return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0])); }
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        else if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        if (uri != null && "content".equals(uri.getScheme())) { if (ready) readCalendar(uri); else pendingUri = uri; }
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleIntent(intent); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request == PICK_CALENDAR && result == RESULT_OK && data != null && data.getData() != null) {
            if (ready) readCalendar(data.getData()); else pendingUri = data.getData();
        }
    }
    private void readCalendar(Uri uri) {
        new Thread(() -> {
            try {
                String name = "University timetable.ics";
                try (Cursor cursor = getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)) {
                    if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("Cannot open file");
                    byte[] buffer = new byte[8192]; int n;
                    while ((n = input.read(buffer)) != -1) { if (bytes.size()+n > 2097152) throw new IOException("Choose a calendar smaller than 2 MB."); bytes.write(buffer,0,n); }
                }
                String text = bytes.toString(StandardCharsets.UTF_8.name());
                String payload = "window.receiveCalendar("+JSONObject.quote(text)+","+JSONObject.quote(name)+")";
                runOnUiThread(() -> web.evaluateJavascript(payload,null));
            } catch (Exception e) {
                runOnUiThread(() -> web.evaluateJavascript("window.importFailed('Could not read this file. Choose an .ics calendar under 2 MB from Downloads.')",null));
            }
        },"calendar-import").start();
    }
    public final class Bridge {
        @JavascriptInterface public boolean systemDark() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }
        @JavascriptInterface public void importCalendar() {
            runOnUiThread(() -> {
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                try { startActivityForResult(pick,PICK_CALENDAR); }
                catch (ActivityNotFoundException e) { web.evaluateJavascript("window.importFailed('No file picker is available on this device.')",null); }
            });
        }
        @JavascriptInterface public void theme(String mode) {
            runOnUiThread(() -> {
                boolean light = "light".equals(mode);
                int color = light ? Color.rgb(246,247,241) : Color.rgb(16,20,18);
                root.setBackgroundColor(color); web.setBackgroundColor(color);
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController control = getWindow().getInsetsController();
                    if (control != null) control.setSystemBarsAppearance(light ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | (light ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
            });
        }
        @JavascriptInterface public void haptic() { runOnUiThread(() -> web.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)); }
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        web.getSettings().setTextZoom(Math.round(config.fontScale * 100));
        web.evaluateJavascript("window.applyTheme && window.applyTheme()",null);
    }
    @Override public void onBackPressed() { web.evaluateJavascript("window.handleBack()", result -> { if (!"true".equals(result)) super.onBackPressed(); }); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.evaluateJavascript("window.refreshClock && window.refreshClock()",null); } }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (web != null) { web.removeJavascriptInterface("Android"); web.destroy(); } super.onDestroy(); }
}
