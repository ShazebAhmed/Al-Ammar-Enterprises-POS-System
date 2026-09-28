package com.alammar.app;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Opens the website like the library's LauncherActivity, but the first time the app
 * is opened on Android 13+ it first asks "Allow ... to send you notifications?". The
 * website then gets the permission from the app (notification delegation) and turns
 * on order updates or store alerts by itself, with no extra button to find.
 */
public class AppLauncherActivity extends LauncherActivity {
    private static final int NOTIFICATIONS_REQUEST = 1;
    private static final String PREFS = "launcher";
    private static final String ASKED = "askedNotifications";

    @Override
    protected boolean shouldLaunchImmediately() {
        if (Build.VERSION.SDK_INT < 33) return true;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) return true;
        // Ask once; after that the phone's settings decide.
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (prefs.getBoolean(ASKED, false)) return true;
        prefs.edit().putBoolean(ASKED, true).apply();
        requestPermissions(
                new String[] {Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS_REQUEST);
        return false;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // Allowed or not, open the website.
        if (requestCode == NOTIFICATIONS_REQUEST) launchTwa();
    }
}
