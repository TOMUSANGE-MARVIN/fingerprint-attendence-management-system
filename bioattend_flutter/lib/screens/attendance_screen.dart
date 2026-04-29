import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/token_manager.dart';
import '../services/fingerprint_channel.dart';
import '../models/models.dart';
import 'select_student_screen.dart';

class AttendanceScreen extends StatefulWidget {
  final Course course;
  const AttendanceScreen({super.key, required this.course});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  AttendanceSession? _session;
  bool _loading = true;
  bool _scanning = false;
  String _statusMsg = 'Connect MFS100 and tap Scan.';
  Color _statusColor = Colors.blue;
  List<Map<String, dynamic>> _log = [];
  String? _fingerprintImageB64;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  @override
  void dispose() {
    super.dispose();
  }

  ApiService get _api {
    final tm = context.read<TokenManager>();
    return ApiService(baseUrl: tm.baseUrl, token: tm.accessToken);
  }

  Future<void> _loadSession() async {
    setState(() => _loading = true);
    try {
      final sessions = await _api.getSessions(widget.course.id, isActive: true);
      if (sessions.isNotEmpty) {
        setState(() => _session = sessions.first);
      } else {
        final tm = context.read<TokenManager>();
        final day = _todayName();
        final slots = await _api.getCourseTimetableSlots(
          widget.course.id,
          day: day,
          studyTime: tm.studyTime,
        );
        if (slots.isEmpty) {
          throw ApiException(
            'No timetable slot found for ${widget.course.code} on $day (${tm.studyTime}).',
          );
        }
        final slot = _pickBestSlot(slots);
        final s = await _api.createSession(
          widget.course.id,
          timetableSlotId: slot['id']?.toString(),
          date: DateTime.now(),
        );
        final started = await _api.startSession(s.id);
        setState(() => _session = started);
      }
      _setStatus('Session ready. Connect MFS100 and tap Scan.', Colors.blue);
    } catch (e) {
      _setStatus('Failed to load session: $e', Colors.red);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _todayName() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    final idx = (DateTime.now().weekday - 1).clamp(0, 6);
    return days[idx];
  }

  Map<String, dynamic> _pickBestSlot(List<Map<String, dynamic>> slots) {
    if (slots.length == 1) return slots.first;

    int toMins(String? t) {
      if (t == null || t.isEmpty) return 0;
      final parts = t.split(':');
      if (parts.length < 2) return 0;
      final h = int.tryParse(parts[0]) ?? 0;
      final m = int.tryParse(parts[1]) ?? 0;
      return h * 60 + m;
    }

    final now = DateTime.now();
    final nowMins = now.hour * 60 + now.minute;
    slots.sort((a, b) => toMins(a['start_time']?.toString()).compareTo(toMins(b['start_time']?.toString())));

    for (final slot in slots) {
      final start = toMins(slot['start_time']?.toString());
      final end = toMins(slot['end_time']?.toString());
      if (nowMins >= start && nowMins <= end) return slot; // current slot
    }
    for (final slot in slots) {
      final start = toMins(slot['start_time']?.toString());
      if (start >= nowMins) return slot; // next upcoming
    }
    return slots.first; // fallback to earliest slot
  }

  Future<void> _onScanPressed() async {
    if (_scanning) return;
    if (_session == null) {
      _setStatus('Preparing attendance session...', Colors.orange);
      await _loadSession();
      if (_session == null) {
        _setStatus('Could not start attendance session. Try again.', Colors.red);
        return;
      }
    }
    setState(() { _scanning = true; _fingerprintImageB64 = null; });
    _setStatus('Initialising scanner...', Colors.orange);

    try {
      // Get enrolled templates from backend
      _setStatus('Fetching enrolled templates...', Colors.orange);
      final templates = await _api.getEnrolledTemplates(_session!.id);

      if (templates.isEmpty) {
        _setStatus('No enrolled students with fingerprints for this course.', Colors.orange);
        setState(() => _scanning = false);
        return;
      }

      _setStatus('Place finger on scanner...', Colors.orange);
      final result = await FingerprintChannel.matchAndCapture(templates);

      if (result.imageB64 != null) {
        setState(() => _fingerprintImageB64 = result.imageB64);
      }

      if (!result.matched || result.studentId == null) {
        _setStatus('No match found. Try again.', Colors.orange);
        setState(() => _scanning = false);
        return;
      }

      _setStatus('Match: ${result.studentName} (score: ${result.score}). Recording...', Colors.green);
      final res = await _api.markPresent(_session!.id, result.studentId!);
      final displayName = res.studentName ?? result.studentName ?? 'Student';
      final displayId = res.studentNumber ?? result.studentId ?? '';
      _addLog(displayName, displayId, res.success, res.message);
      _setStatus(
        res.success ? '✓ $displayName marked present' : res.message,
        res.success ? Colors.green : Colors.red,
      );
    } on PlatformException catch (e) {
      _setStatus('Scanner: ${e.message}', Colors.red);
    } catch (e) {
      _setStatus('Error: $e', Colors.red);
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _markManual() async {
    if (_session == null) return;
    final tm = context.read<TokenManager>();
    final student = await Navigator.push<Student>(
      context,
      MaterialPageRoute(builder: (_) => SelectStudentScreen(
        courseId: widget.course.id,
        cohortId: tm.cohortId,
        studyTime: tm.studyTime,
      )),
    );
    if (student == null) return;
    try {
      final res = await _api.markPresent(_session!.id, student.id);
      _addLog(student.fullName, student.studentId, res.success, res.message);
      _showSnack(res.message, isError: !res.success);
    } catch (e) {
      _showSnack('Error: $e', isError: true);
    }
  }

  Future<void> _endSession() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End Session'),
        content: const Text('Are you sure you want to end this attendance session?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red[700]),
            child: const Text('End Session'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.endSession(_session!.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showSnack('Error: $e', isError: true);
    }
  }

  void _addLog(String name, String id, bool success, String msg) {
    setState(() => _log.insert(0, {
          'name': name,
          'id': id,
          'success': success,
          'message': msg,
          'time': TimeOfDay.now().format(context),
        }));
  }

  void _setStatus(String msg, Color color) {
    if (mounted) setState(() { _statusMsg = msg; _statusColor = color; });
  }

  void _showSnack(String msg, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red[700] : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F0),
      appBar: AppBar(
        title: Text(widget.course.code,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2E7D32),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_session != null)
            TextButton.icon(
              onPressed: _endSession,
              icon: const Icon(Icons.stop_circle_outlined, color: Colors.white70),
              label: const Text('End', style: TextStyle(color: Colors.white70)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2E7D32)))
          : Column(
              children: [
                // Course header
                Container(
                  width: double.infinity,
                  color: const Color(0xFF2E7D32),
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: Text(widget.course.name,
                      style: const TextStyle(color: Colors.white, fontSize: 15)),
                ),

                // Status bar
                Container(
                  width: double.infinity,
                  color: _statusColor.withAlpha(25),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(children: [
                    Icon(Icons.info_outline, color: _statusColor, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_statusMsg,
                          style: TextStyle(color: _statusColor, fontSize: 13)),
                    ),
                  ]),
                ),

                // Fingerprint image
                if (_fingerprintImageB64 != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.memory(
                        base64Decode(_fingerprintImageB64!),
                        width: 120,
                        height: 120,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),

                // Scan button
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _scanning ? null : _onScanPressed,
                          icon: _scanning
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.fingerprint),
                          label: Text(_scanning ? 'Scanning...' : 'Scan Fingerprint'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF2E7D32),
                            minimumSize: const Size.fromHeight(50),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: _markManual,
                        icon: const Icon(Icons.person_add_alt_1,
                            color: Color(0xFF2E7D32)),
                        label: const Text('Manual',
                            style: TextStyle(color: Color(0xFF2E7D32))),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF2E7D32)),
                          minimumSize: const Size(0, 50),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),

                // Present count
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Row(children: [
                    const Icon(Icons.people, color: Color(0xFF2E7D32), size: 18),
                    const SizedBox(width: 6),
                    Text('${_log.where((e) => e['success'] == true).length} present this session',
                        style: const TextStyle(
                            color: Color(0xFF2E7D32), fontWeight: FontWeight.w600)),
                  ]),
                ),

                const Divider(height: 1),

                // Log
                Expanded(
                  child: _log.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.fingerprint, size: 56, color: Colors.grey[300]),
                              const SizedBox(height: 8),
                              Text('No attendance recorded yet',
                                  style: TextStyle(color: Colors.grey[500])),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _log.length,
                          itemBuilder: (_, i) {
                            final e = _log[i];
                            final ok = e['success'] as bool;
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              color: ok ? Colors.green[50] : Colors.red[50],
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  side: BorderSide(
                                      color: ok ? Colors.green[200]! : Colors.red[200]!)),
                              child: ListTile(
                                dense: true,
                                leading: Icon(
                                    ok ? Icons.check_circle : Icons.cancel,
                                    color: ok ? const Color(0xFF2E7D32) : Colors.red[700]),
                                title: Text(e['name'] as String,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600, fontSize: 14)),
                                subtitle: Text(e['id'] as String,
                                    style: const TextStyle(fontSize: 12)),
                                trailing: Text(e['time'] as String,
                                    style: const TextStyle(
                                        fontSize: 12, color: Colors.grey)),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
