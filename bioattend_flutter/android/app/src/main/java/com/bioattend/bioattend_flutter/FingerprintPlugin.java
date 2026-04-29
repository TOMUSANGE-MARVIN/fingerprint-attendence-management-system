package com.bioattend.bioattend_flutter;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;

import com.mantra.mfs100.FingerData;
import com.mantra.mfs100.MFS100;
import com.mantra.mfs100.MFS100Event;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.flutter.plugin.common.BinaryMessenger;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

public class FingerprintPlugin implements MethodChannel.MethodCallHandler, MFS100Event {

    private static final String CHANNEL = "com.bioattend/fingerprint";
    private static final String ACTION_USB_PERMISSION = "com.bioattend.bioattend_flutter.USB_PERMISSION";
    private static final String TAG = "BioAttend";

    private final Activity activity;
    private MFS100 mfs100;
    private UsbManager usbManager;
    private UsbDeviceConnection usbConnection;
    private boolean scannerReady = false;

    // Set when waiting for USB permission then capture
    private MethodChannel.Result pendingResult;
    private boolean pendingIsMatch;
    private List<Map<String, String>> pendingTemplates;

    private final BroadcastReceiver usbPermissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            Log.d(TAG, "USB permission granted=" + granted);
            if (granted) {
                injectFdAndInit(true);
            } else {
                failPending("USB_DENIED", "USB permission denied. Tap button and allow access.");
            }
        }
    };

    public FingerprintPlugin(Activity activity, BinaryMessenger messenger) {
        this.activity = activity;
        usbManager = (UsbManager) activity.getSystemService(Context.USB_SERVICE);

        // Register USB permission broadcast receiver
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(usbPermissionReceiver, filter);
        }

        // Load SDK
        try {
            mfs100 = new MFS100(this);
            mfs100.SetApplicationContext(activity);
            Log.d(TAG, "MFS100 SDK loaded");
        } catch (UnsatisfiedLinkError | Exception e) {
            Log.e(TAG, "MFS100 SDK load failed: " + e.getMessage());
            mfs100 = null;
        }

        new MethodChannel(messenger, CHANNEL).setMethodCallHandler(this);

        // Silent init attempt if scanner already connected
        checkUsbAndInit(false);
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        if (mfs100 == null) {
            result.error("SDK_FAILED", "Fingerprint SDK failed to load", null);
            return;
        }
        switch (call.method) {
            case "isReady":
                result.success(scannerReady);
                break;
            case "capture":
                pendingResult = result;
                pendingIsMatch = false;
                pendingTemplates = null;
                if (scannerReady) {
                    captureForEnroll(result);
                    pendingResult = null;
                } else {
                    checkUsbAndInit(true);
                }
                break;
            case "matchAndCapture":
                pendingResult = result;
                pendingIsMatch = true;
                pendingTemplates = call.argument("templates");
                if (scannerReady) {
                    captureAndMatch(result, pendingTemplates);
                    pendingResult = null;
                } else {
                    checkUsbAndInit(true);
                }
                break;
            case "checkDuplicate":
                String captured = call.argument("captured");
                List<Map<String, String>> dupTemplates = call.argument("templates");
                checkDuplicate(result, captured, dupTemplates);
                break;
            case "dispose":
                disposeScanner();
                result.success(null);
                break;
            default:
                result.notImplemented();
        }
    }

    // ── USB ──────────────────────────────────────────────────────────────────

    private void checkUsbAndInit(boolean triggerCapture) {
        UsbDevice device = findMfs100();
        if (device == null) {
            if (triggerCapture) {
                failPending("NO_DEVICE", "MFS100 not detected. Connect scanner via USB OTG.");
            }
            return;
        }
        if (usbManager.hasPermission(device)) {
            injectFdAndInit(triggerCapture);
        } else {
            PendingIntent pi = PendingIntent.getBroadcast(
                    activity, 0,
                    new Intent(ACTION_USB_PERMISSION),
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            usbManager.requestPermission(device, pi);
        }
    }

    private void injectFdAndInit(boolean triggerCapture) {
        UsbDevice device = findMfs100();
        if (device == null) {
            failPending("NO_DEVICE", "MFS100 not found. Connect via USB OTG.");
            return;
        }

        if (usbConnection != null) {
            try { usbConnection.close(); } catch (Exception ignored) {}
            usbConnection = null;
        }

        usbConnection = usbManager.openDevice(device);
        if (usbConnection == null) {
            failPending("USB_OPEN_FAILED", "Cannot open USB device. Grant permission and retry.");
            return;
        }

        int fd = usbConnection.getFileDescriptor();
        Log.d(TAG, "USB fd=" + fd);
        if (fd <= 0) {
            failPending("BAD_FD", "Invalid USB descriptor. Reconnect the scanner.");
            return;
        }

        // Inject fd and clear permission-denied flag (same fix as Java app for Android 12+)
        try {
            Field fdField = MFS100.class.getDeclaredField("fd");
            fdField.setAccessible(true);
            fdField.set(mfs100, fd);

            Field permField = MFS100.class.getDeclaredField("isHasPermissionDenied");
            permField.setAccessible(true);
            permField.set(mfs100, false);

            Log.d(TAG, "Injected fd=" + fd + ", cleared isHasPermissionDenied");
        } catch (Exception e) {
            Log.e(TAG, "Reflection failed: " + e);
            failPending("SDK_COMPAT", "SDK reflection error: " + e.getMessage());
            return;
        }

        // If scanner was previously initialised, dispose it before re-init
        if (scannerReady) {
            try { mfs100.Dispose(); } catch (Exception ignored) {}
            scannerReady = false;
        }

        // Init scanner
        int ret = mfs100.Init();
        Log.d(TAG, "Init() = " + ret + " / " + mfs100.GetErrorMsg(ret));
        if (ret == 0) {
            scannerReady = true;
            if (triggerCapture && pendingResult != null) {
                MethodChannel.Result r = pendingResult;
                pendingResult = null;
                if (pendingIsMatch) {
                    captureAndMatch(r, pendingTemplates);
                } else {
                    captureForEnroll(r);
                }
            }
        } else {
            scannerReady = false;
            String msg = "Init [" + ret + "]: " + mfs100.GetErrorMsg(ret);
            String lastErr = mfs100.GetLastError();
            if (lastErr != null && !lastErr.isEmpty()) msg += " | " + lastErr;
            Log.e(TAG, msg);
            failPending("INIT_FAILED", msg);
        }
    }

    private UsbDevice findMfs100() {
        if (usbManager == null) return null;
        for (UsbDevice dev : usbManager.getDeviceList().values()) {
            int vid = dev.getVendorId();
            Log.d(TAG, "USB device VID=" + vid + " PID=" + dev.getProductId());
            if (vid == 1204 || vid == 11279) return dev;
        }
        return null;
    }

    // ── Capture ───────────────────────────────────────────────────────────────

    /** Capture for enrollment: returns {template, image, quality, nfiq} */
    private void captureForEnroll(final MethodChannel.Result result) {
        new Thread(() -> {
            FingerData fingerData = new FingerData();
            int ret = mfs100.AutoCapture(fingerData, 15000, false);

            if (ret != 0) {
                String msg = "Capture failed: " + mfs100.GetErrorMsg(ret);
                activity.runOnUiThread(() -> result.error("CAPTURE_FAILED", msg, null));
                return;
            }

            byte[] iso = fingerData.ISOTemplate();
            if (iso == null || iso.length == 0) {
                activity.runOnUiThread(() ->
                        result.error("EMPTY_TEMPLATE", "Empty template. Try again.", null));
                return;
            }

            String templateB64 = Base64.encodeToString(iso, Base64.NO_WRAP);
            String imageB64 = null;
            byte[] imgBytes = fingerData.FingerImage();
            if (imgBytes != null) {
                imageB64 = Base64.encodeToString(imgBytes, Base64.NO_WRAP);
            }

            Map<String, Object> res = new HashMap<>();
            res.put("template", templateB64);
            res.put("image", imageB64 != null ? imageB64 : "");
            res.put("quality", (int) fingerData.Quality());
            res.put("nfiq", (int) fingerData.Nfiq());

            final Map<String, Object> finalRes = res;
            activity.runOnUiThread(() -> result.success(finalRes));
        }).start();
    }

    /** Capture then match against enrolled templates, returns best match */
    private void captureAndMatch(final MethodChannel.Result result,
                                  final List<Map<String, String>> templates) {
        new Thread(() -> {
            FingerData fingerData = new FingerData();
            int ret = mfs100.AutoCapture(fingerData, 15000, false);

            if (ret != 0) {
                String msg = "Capture failed: " + mfs100.GetErrorMsg(ret);
                activity.runOnUiThread(() -> result.error("CAPTURE_FAILED", msg, null));
                return;
            }

            byte[] capturedIso = fingerData.ISOTemplate();
            if (capturedIso == null || capturedIso.length == 0) {
                activity.runOnUiThread(() ->
                        result.error("EMPTY_TEMPLATE", "Empty template. Try again.", null));
                return;
            }

            String imageB64 = "";
            byte[] imgBytes = fingerData.FingerImage();
            if (imgBytes != null) {
                imageB64 = Base64.encodeToString(imgBytes, Base64.NO_WRAP);
            }

            // Match on device using Mantra MatchISO() — score >= 96 is a match
            String bestId = null;
            String bestName = null;
            int bestScore = 0;

            if (templates != null) {
                for (Map<String, String> st : templates) {
                    try {
                        String tb64 = st.get("template");
                        if (tb64 == null || tb64.isEmpty()) continue;
                        byte[] stored = Base64.decode(tb64, Base64.NO_WRAP);
                        int score = mfs100.MatchISO(capturedIso, stored);
                        Log.d(TAG, "MatchISO " + st.get("name") + " → " + score);
                        if (score >= 96 && score > bestScore) {
                            bestScore = score;
                            bestId = st.get("id");
                            bestName = st.get("name");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "MatchISO error: " + e.getMessage());
                    }
                }
            }

            Map<String, Object> res = new HashMap<>();
            res.put("image", imageB64);
            res.put("matched", bestId != null);
            res.put("studentId", bestId != null ? bestId : "");
            res.put("studentName", bestName != null ? bestName : "");
            res.put("score", bestScore);

            final Map<String, Object> finalRes = res;
            activity.runOnUiThread(() -> result.success(finalRes));
        }).start();
    }

    /** Match a pre-captured template against enrolled templates to detect duplicates */
    private void checkDuplicate(final MethodChannel.Result result,
                                 final String capturedB64,
                                 final List<Map<String, String>> templates) {
        if (capturedB64 == null || capturedB64.isEmpty()) {
            Map<String, Object> res = new HashMap<>();
            res.put("matched", false);
            result.success(res);
            return;
        }
        new Thread(() -> {
            byte[] capturedIso;
            try {
                capturedIso = Base64.decode(capturedB64, Base64.NO_WRAP);
            } catch (Exception e) {
                activity.runOnUiThread(() -> result.error("DECODE_FAILED", "Bad template", null));
                return;
            }

            String matchName = null;
            int matchScore = 0;

            if (templates != null) {
                for (Map<String, String> st : templates) {
                    try {
                        String tb64 = st.get("template");
                        if (tb64 == null || tb64.isEmpty()) continue;
                        byte[] stored = Base64.decode(tb64, Base64.NO_WRAP);
                        int score = mfs100.MatchISO(capturedIso, stored);
                        Log.d(TAG, "DupCheck " + st.get("name") + " → " + score);
                        if (score >= 96 && score > matchScore) {
                            matchScore = score;
                            matchName = st.get("name");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "DupCheck MatchISO error: " + e.getMessage());
                    }
                }
            }

            Map<String, Object> res = new HashMap<>();
            res.put("matched", matchName != null);
            res.put("studentName", matchName != null ? matchName : "");
            res.put("score", matchScore);
            final Map<String, Object> finalRes = res;
            activity.runOnUiThread(() -> result.success(finalRes));
        }).start();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void failPending(String code, String msg) {
        if (pendingResult != null) {
            final MethodChannel.Result r = pendingResult;
            pendingResult = null;
            activity.runOnUiThread(() -> r.error(code, msg, null));
        }
    }

    private void disposeScanner() {
        scannerReady = false;
        if (mfs100 != null) { try { mfs100.Dispose(); } catch (Exception ignored) {} }
        if (usbConnection != null) {
            try { usbConnection.close(); } catch (Exception ignored) {}
            usbConnection = null;
        }
    }

    // ── MFS100Event ───────────────────────────────────────────────────────────

    @Override
    public void OnDeviceAttached(int vid, int pid, boolean hasPermission) {
        Log.d(TAG, "OnDeviceAttached VID=" + vid + " PID=" + pid + " perm=" + hasPermission);
        // Auto-init when scanner plugged in
        if (hasPermission) {
            activity.runOnUiThread(() -> injectFdAndInit(false));
        }
    }

    @Override
    public void OnDeviceDetached() {
        Log.d(TAG, "OnDeviceDetached");
        scannerReady = false;
        if (usbConnection != null) {
            try { usbConnection.close(); } catch (Exception ignored) {}
            usbConnection = null;
        }
    }

    @Override
    public void OnHostCheckFailed(String err) {
        Log.e(TAG, "OnHostCheckFailed: " + err);
    }
}
