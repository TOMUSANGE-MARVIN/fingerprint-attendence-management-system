import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/token_manager.dart';
import '../services/api_service.dart';
import '../services/token_manager.dart';
import '../services/fingerprint_channel.dart';
import '../models/models.dart';
import 'select_student_screen.dart';

class EnrollmentScreen extends StatefulWidget {
  const EnrollmentScreen({super.key});

  @override
  State<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<EnrollmentScreen> {
  Student? _student;
  bool _capturing = false;
  bool _enrolled = false;
  String _statusMsg = 'Select a student then capture their fingerprint.';
  Color _statusColor = Colors.blue;
  String? _fingerprintImageB64;
  int? _quality;
  int? _nfiq;

  @override
  void dispose() {
    super.dispose();
  }

  ApiService get _api {
    final tm = context.read<TokenManager>();
    return ApiService(baseUrl: tm.baseUrl, token: tm.accessToken);
  }

  Future<void> _pickStudent() async {
    final tm = context.read<TokenManager>();
    final student = await Navigator.push<Student>(
      context,
      MaterialPageRoute(builder: (_) => SelectStudentScreen(
        courseId: '',
        cohortId: tm.cohortId,
        studyTime: tm.studyTime,
      )),
    );
    if (student != null) {
      setState(() {
        _student = student;
        _enrolled = false;
        _fingerprintImageB64 = null;
        _quality = null;
        _nfiq = null;
      });
      _setStatus('Student selected. Connect MFS100 and tap Capture.', Colors.blue);
    }
  }

  Future<void> _captureAndEnroll() async {
    if (_student == null) {
      _showSnack('Please select a student first.');
      return;
    }
    if (_capturing) return;
    setState(() { _capturing = true; _enrolled = false; _fingerprintImageB64 = null; });
    _setStatus('Place finger on scanner...', Colors.orange);

    try {
      final result = await FingerprintChannel.capture();

      setState(() {
        _fingerprintImageB64 = result.imageB64;
        _quality = result.quality;
        _nfiq = result.nfiq;
      });

      if (result.templateB64.isEmpty) {
        _setStatus('Capture error: empty template. Try again.', Colors.red);
        return;
      }

      // Check for duplicate fingerprint across all enrolled students in the cohort
      _setStatus('Checking for duplicate fingerprint...', Colors.orange);
      final enrolled = await _api.getCohortFingerprintTemplates();
      if (enrolled.isNotEmpty) {
        final dupName = await FingerprintChannel.checkDuplicate(result.templateB64, enrolled);
        if (dupName != null) {
          _setStatus('Duplicate fingerprint — already enrolled for $dupName.', Colors.red);
          return;
        }
      }

      _setStatus('Saving fingerprint...', Colors.orange);
      await _api.registerFingerprint(_student!.id, result.templateB64);
      setState(() => _enrolled = true);
      _setStatus('✓ Fingerprint enrolled for ${_student!.fullName}', Colors.green);
      _showSnack('Enrollment successful!');
    } on PlatformException catch (e) {
      _setStatus('Scanner: ${e.message ?? e.code}', Colors.red);
    } catch (e) {
      _setStatus('Error: $e', Colors.red);
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  void _setStatus(String msg, Color color) {
    if (mounted) setState(() { _statusMsg = msg; _statusColor = color; });
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      behavior: SnackBarBehavior.floating,
      backgroundColor: const Color(0xFF2E7D32),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F0),
      appBar: AppBar(
        title: const Text('Fingerprint Enrollment',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2E7D32),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Student selection card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: InkWell(
                onTap: _pickStudent,
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: const Color(0xFF2E7D32).withAlpha(25),
                        child: Text(
                          _student != null
                              ? _student!.firstName[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: Color(0xFF2E7D32),
                              fontSize: 20,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _student?.fullName ?? 'Tap to select student',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: _student != null
                                      ? Colors.black87
                                      : Colors.grey[500]),
                            ),
                            if (_student != null)
                              Text(_student!.studentId,
                                  style: const TextStyle(
                                      color: Colors.grey, fontSize: 13)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.grey),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Fingerprint display
            Center(
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: _enrolled
                          ? const Color(0xFF2E7D32)
                          : Colors.grey[300]!,
                      width: 2),
                ),
                child: _fingerprintImageB64 != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: Image.memory(
                          base64Decode(_fingerprintImageB64!),
                          fit: BoxFit.cover,
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.fingerprint,
                              size: 72,
                              color: _capturing
                                  ? Colors.orange
                                  : Colors.grey[400]),
                          if (_capturing)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text('Scanning...',
                                  style: TextStyle(
                                      color: Colors.orange[700], fontSize: 12)),
                            ),
                        ],
                      ),
              ),
            ),

            if (_quality != null) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Quality: $_quality   NFIQ: $_nfiq',
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Status
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _statusColor.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _statusColor.withAlpha(80)),
              ),
              child: Row(children: [
                Icon(
                    _enrolled
                        ? Icons.check_circle
                        : Icons.info_outline,
                    color: _statusColor,
                    size: 18),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(_statusMsg,
                        style: TextStyle(color: _statusColor, fontSize: 13))),
              ]),
            ),

            const SizedBox(height: 20),

            // Capture button
            FilledButton.icon(
              onPressed: _capturing ? null : _captureAndEnroll,
              icon: _capturing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Icon(_enrolled ? Icons.refresh : Icons.fingerprint),
              label: Text(_capturing
                  ? 'Capturing...'
                  : _enrolled
                      ? 'Re-enroll'
                      : 'Capture Fingerprint'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
