package com.bioattend.bioattend_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        FingerprintPlugin(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}
