package com.pocketly.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.app.NotificationCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_MIC = 201;
    private String pendingShortcutAction = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Detect initial system mode (DayNight)
        boolean isSystemNight = (getResources().getConfiguration().uiMode
            & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        applySystemBarTheme(isSystemNight);

        // Request Microphone permission if not already granted
        checkAndRequestMicPermission();

        // Handle Launcher Shortcut Intent if app launched via shortcut
        handleShortcutIntent(getIntent());

        // Configure WebView (disable scrollbars, register JavascriptInterface)
        configureWebView();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShortcutIntent(intent);
    }

    private void handleShortcutIntent(Intent intent) {
        if (intent == null) return;
        String action = null;
        if (intent.hasExtra("action")) {
            action = intent.getStringExtra("action");
        }
        if ((action == null || action.isEmpty()) && intent.getData() != null) {
            Uri data = intent.getData();
            action = data.getQueryParameter("action");
        }
        if (action != null && !action.isEmpty()) {
            this.pendingShortcutAction = action;
            dispatchShortcutActionToWeb(action);
        }
    }

    private void dispatchShortcutActionToWeb(final String action) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "(function(){ if (typeof window.handleNativeShortcutAction === 'function') { window.handleNativeShortcutAction('" + action + "'); } else { window.__pendingShortcutAction = '" + action + "'; } })();",
                        null
                    );
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            configureWebView();
            updateStatusBarHeightInWebView();
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "(function(){ var isDark = document.body.classList.contains('dark-mode') || (localStorage.getItem('theme') === 'dark'); if (window.AndroidNative && window.AndroidNative.setSystemBarTheme) window.AndroidNative.setSystemBarTheme(isDark); })();",
                    null
                );
            }
            if (pendingShortcutAction != null && !pendingShortcutAction.isEmpty()) {
                dispatchShortcutActionToWeb(pendingShortcutAction);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void configureWebView() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                // Disable Android native scrollbar thumb on the right edge
                webView.setVerticalScrollBarEnabled(false);
                webView.setHorizontalScrollBarEnabled(false);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                webView.addJavascriptInterface(new AndroidNativeInterface(), "AndroidNative");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public int getStatusBarHeightDp() {
        int statusBarHeight = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = getResources().getDimensionPixelSize(resourceId);
        }
        float density = getResources().getDisplayMetrics().density;
        int heightDp = (int) Math.ceil(statusBarHeight / (density > 0 ? density : 1));
        return heightDp > 0 ? heightDp : 38;
    }

    private void updateStatusBarHeightInWebView() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                int heightDp = getStatusBarHeightDp();
                getBridge().getWebView().evaluateJavascript(
                    "document.documentElement.style.setProperty('--status-bar-height', '" + heightDp + "px');",
                    null
                );
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void applySystemBarTheme(final boolean isDark) {
        runOnUiThread(() -> {
            try {
                Window window = getWindow();
                if (window == null) return;

                // Edge-to-edge status bar so notch blur sits underneath clock/battery
                WindowCompat.setDecorFitsSystemWindows(window, false);

                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

                int navBgColor = isDark
                    ? Color.parseColor("#0b0f19")
                    : Color.parseColor("#f8fafc");

                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(navBgColor);

                // Disable Android 10+ forced contrast scrim so status bar & navigation bar stay crystal clean
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.setStatusBarContrastEnforced(false);
                    window.setNavigationBarContrastEnforced(false);
                }

                View decorView = window.getDecorView();
                WindowInsetsControllerCompat insetsController =
                    WindowCompat.getInsetsController(window, decorView);

                if (insetsController != null) {
                    // Light theme: dark text & icons on light background -> true
                    // Dark theme: light text & icons on dark background -> false
                    insetsController.setAppearanceLightStatusBars(!isDark);
                    insetsController.setAppearanceLightNavigationBars(!isDark);
                }

                updateStatusBarHeightInWebView();
                configureWebView();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    public void checkAndRequestMicPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.MODIFY_AUDIO_SETTINGS
                },
                PERMISSION_REQUEST_MIC
            );
        }
    }

    public boolean checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    202
                );
            }
        }
    }

    public void showNativeNotification(final String title, final String body, final int notifId) {
        runOnUiThread(() -> {
            try {
                NotificationManager notificationManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager == null) return;

                String channelId = "pocketly_alerts_channel";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Notifikasi Pocketly",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Peringatan dan pengingat finansial Pocketly");
                    channel.enableLights(true);
                    channel.enableVibration(true);
                    channel.setShowBadge(true);
                    notificationManager.createNotificationChannel(channel);
                }

                Intent intent = new Intent(this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    notifId > 0 ? notifId : 101,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                NotificationCompat.Builder builder =
                    new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(R.drawable.ic_notification)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                notificationManager.notify(notifId > 0 ? notifId : (int) System.currentTimeMillis(), builder.build());
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    public class AndroidNativeInterface {

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public String getPendingShortcutAction() {
            String act = pendingShortcutAction;
            pendingShortcutAction = null;
            return act != null ? act : "";
        }

        @JavascriptInterface
        public boolean isNotificationPermissionGranted() {
            return MainActivity.this.checkNotificationPermission();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> MainActivity.this.requestNotificationPermission());
        }

        @JavascriptInterface
        public void showNotification(final String title, final String body, final int notifId) {
            MainActivity.this.showNativeNotification(title, body, notifId);
        }

        @JavascriptInterface
        public int getStatusBarHeightDp() {
            return MainActivity.this.getStatusBarHeightDp();
        }

        @JavascriptInterface
        public void setSystemBarTheme(final boolean isDark) {
            runOnUiThread(() -> applySystemBarTheme(isDark));
        }

        @JavascriptInterface
        public boolean isMicrophoneGranted() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestMicrophonePermission() {
            runOnUiThread(() -> checkAndRequestMicPermission());
        }

        @JavascriptInterface
        public boolean isBiometricAvailable() {
            try {
                BiometricManager biometricManager = BiometricManager.from(MainActivity.this);
                int canAuthenticate = biometricManager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG |
                    BiometricManager.Authenticators.BIOMETRIC_WEAK
                );
                return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS ||
                       canAuthenticate == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void authenticateBiometric(final String title, final String subtitle) {
            runOnUiThread(() -> {
                try {
                    Executor executor = ContextCompat.getMainExecutor(MainActivity.this);
                    BiometricPrompt biometricPrompt = new BiometricPrompt(
                        MainActivity.this,
                        executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "if(window.__pocketlyBioCallback) window.__pocketlyBioCallback(true, null);",
                                        null
                                    );
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "if(window.__pocketlyBioCallback) window.__pocketlyBioCallback(false, '" + errString + "');",
                                        null
                                    );
                                }
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                super.onAuthenticationFailed();
                            }
                        }
                    );

                    BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title != null && !title.isEmpty() ? title : "Buka Pocketly")
                        .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Gunakan sensor sidik jari atau pengenalan wajah")
                        .setNegativeButtonText("Gunakan PIN")
                        .build();

                    biometricPrompt.authenticate(promptInfo);
                } catch (Exception e) {
                    e.printStackTrace();
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().evaluateJavascript(
                            "if(window.__pocketlyBioCallback) window.__pocketlyBioCallback(false, '" + e.getMessage() + "');",
                            null
                        );
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveBase64File(final String base64Data, final String fileName, final String mimeType) {
            runOnUiThread(() -> {
                try {
                    byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                    Uri fileUri = null;
                    File directFile = null;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(fileBytes);
                                    os.flush();
                                    fileUri = uri;
                                }
                            }
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) downloadsDir.mkdirs();
                        directFile = new File(downloadsDir, fileName);
                        try (FileOutputStream fos = new FileOutputStream(directFile)) {
                            fos.write(fileBytes);
                            fos.flush();
                        }
                        fileUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            directFile
                        );
                    }

                    Toast.makeText(
                        MainActivity.this,
                        "Berhasil disimpan di folder Downloads: " + fileName,
                        Toast.LENGTH_LONG
                    ).show();

                    // Open Share / View Chooser so the user can immediately open, view, or send the file
                    if (fileUri != null) {
                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                        sendIntent.setType(mimeType);
                        sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(sendIntent, "Buka atau Bagikan: " + fileName));
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "Gagal mengunduh file: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
