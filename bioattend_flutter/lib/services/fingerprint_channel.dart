import 'package:flutter/services.dart';

class FingerprintChannel {
  static const _ch = MethodChannel('com.bioattend/fingerprint');

  static Future<bool> isReady() async {
    return await _ch.invokeMethod<bool>('isReady') ?? false;
  }

  static Future<void> init() async {
    await _ch.invokeMethod('init');
  }

  /// Captures one fingerprint. Returns template (base64 ISO), image (base64),
  /// quality, and nfiq score.
  static Future<CaptureResult> capture() async {
    final res = await _ch.invokeMapMethod<String, dynamic>('capture');
    return CaptureResult(
      templateB64: res?['template'] as String? ?? '',
      imageB64: res?['image'] as String?,
      quality: res?['quality'] as int? ?? 0,
      nfiq: res?['nfiq'] as int? ?? 0,
    );
  }

  /// Captures a fingerprint and matches against [templates].
  /// Each template is {id, name, template (base64)}.
  static Future<MatchResult> matchAndCapture(
      List<Map<String, String>> templates) async {
    final res = await _ch.invokeMapMethod<String, dynamic>('matchAndCapture', {
      'templates': templates,
    });
    return MatchResult(
      matched: res?['matched'] as bool? ?? false,
      studentId: res?['studentId'] as String?,
      studentName: res?['studentName'] as String?,
      score: res?['score'] as int? ?? 0,
      imageB64: res?['image'] as String?,
    );
  }

  /// Matches a captured template (base64) against a list of enrolled templates.
  /// Returns the matching student name if a duplicate is found, null otherwise.
  static Future<String?> checkDuplicate(
      String capturedTemplateB64, List<Map<String, String>> enrolledTemplates) async {
    final res = await _ch.invokeMapMethod<String, dynamic>('checkDuplicate', {
      'captured': capturedTemplateB64,
      'templates': enrolledTemplates,
    });
    final matched = res?['matched'] as bool? ?? false;
    if (!matched) return null;
    return res?['studentName'] as String?;
  }

  static Future<void> dispose() async {
    await _ch.invokeMethod('dispose');
  }
}

class CaptureResult {
  final String templateB64;
  final String? imageB64;
  final int quality;
  final int nfiq;
  CaptureResult(
      {required this.templateB64,
      this.imageB64,
      required this.quality,
      required this.nfiq});
}

class MatchResult {
  final bool matched;
  final String? studentId;
  final String? studentName;
  final int score;
  final String? imageB64;
  MatchResult(
      {required this.matched,
      this.studentId,
      this.studentName,
      required this.score,
      this.imageB64});
}
