import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

class ApiService {
  final String baseUrl;
  final String? token;
  final String? refreshToken;

  ApiService({required this.baseUrl, this.token, this.refreshToken});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Uri _uri(String path, [Map<String, String>? params]) {
    final url = baseUrl.endsWith('/') ? baseUrl : '$baseUrl/';
    final uri = Uri.parse('$url$path');
    return params != null ? uri.replace(queryParameters: params) : uri;
  }

  String _two(int n) => n.toString().padLeft(2, '0');
  String _date(DateTime dt) => '${dt.year.toString().padLeft(4, '0')}-${_two(dt.month)}-${_two(dt.day)}';
  String _time(DateTime dt) => '${_two(dt.hour)}:${_two(dt.minute)}:${_two(dt.second)}';

  String _parseError(http.Response res) {
    try {
      final d = jsonDecode(res.body);
      if (d is Map) {
        // Try common error fields
        if (d['detail'] != null) return d['detail'].toString();
        if (d['error'] != null) return d['error'].toString();
        return d.values.expand((v) => v is List ? v.map((e) => e.toString()) : [v.toString()]).join(' ');
      }
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? params]) async {
    final res = await http.get(_uri(path, params), headers: _headers);
    if (res.statusCode == 401) throw ApiException('Session expired. Please log out and log in again.', 401);
    if (res.statusCode >= 400) throw ApiException(_parseError(res), res.statusCode);
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(_uri(path), headers: _headers, body: jsonEncode(body));
    if (res.statusCode == 401) throw ApiException('Session expired. Please log out and log in again.', 401);
    if (res.statusCode >= 400) throw ApiException(_parseError(res), res.statusCode);
    return jsonDecode(res.body);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  Future<LoginResponse> login(String email, String password) async {
    final data = await _post('auth/login/', {'email': email, 'password': password});
    return LoginResponse.fromJson(data);
  }

  Future<Map<String, dynamic>> getMe() async {
    return await _get('auth/me/');
  }

  // ── Courses ───────────────────────────────────────────────────────────────

  Future<List<Course>> getCourses() async {
    final data = await _get('courses/');
    final results = data['results'] ?? data;
    return (results as List).map((c) => Course.fromJson(c)).toList();
  }

  Future<CoordinatorResponse> getCoordinatorData() async {
    final data = await _get('courses/my-coordinated/');
    return CoordinatorResponse.fromJson(data);
  }

  // ── Attendance sessions ───────────────────────────────────────────────────

  Future<List<AttendanceSession>> getSessions(String courseId, {bool isActive = true}) async {
    final data = await _get('attendance/sessions/', {
      'course': courseId,
      'is_active': isActive.toString(),
    });
    final results = data['results'] ?? data;
    return (results as List).map((s) => AttendanceSession.fromJson(s)).toList();
  }

  Future<List<Map<String, dynamic>>> getCourseTimetableSlots(
    String courseId, {
    String? day,
    String? studyTime,
  }) async {
    final params = <String, String>{'course': courseId};
    if (day != null && day.isNotEmpty) params['day'] = day;
    if (studyTime != null && studyTime.isNotEmpty) params['study_time'] = studyTime;
    final data = await _get('timetable/slots/', params);
    final results = data['results'] ?? data;
    return (results as List).cast<Map<String, dynamic>>();
  }

  Future<AttendanceSession> createSession(
    String courseId, {
    String? timetableSlotId,
    DateTime? date,
  }) async {
    final when = date ?? DateTime.now();
    final payload = <String, dynamic>{
      'course': courseId,
      'date': _date(when),
      'title': 'Mobile Attendance Session',
      'session_type': 'lecture',
    };
    if (timetableSlotId != null && timetableSlotId.isNotEmpty) {
      payload['timetable_slot'] = timetableSlotId;
    }
    final data = await _post('attendance/sessions/', payload);
    return AttendanceSession.fromJson(data);
  }

  Future<AttendanceSession> startSession(String sessionId) async {
    final data = await _post('attendance/sessions/$sessionId/start/', {});
    return AttendanceSession.fromJson(data);
  }

  Future<AttendanceSession> endSession(String sessionId) async {
    final data = await _post('attendance/sessions/$sessionId/end/', {});
    return AttendanceSession.fromJson(data);
  }

  // ── Fingerprint ───────────────────────────────────────────────────────────

  Future<FingerprintVerifyResponse> markPresent(
      String sessionId, String studentId) async {
    final data = await _post(
        'attendance/sessions/$sessionId/mark-present/', {'student_id': studentId});
    return FingerprintVerifyResponse.fromJson(data);
  }

  Future<List<Map<String, String>>> getEnrolledTemplates(String sessionId) async {
    final data = await _get('attendance/sessions/$sessionId/enrolled-templates/');
    final students = data['students'] as List? ?? [];
    return students.map<Map<String, String>>((s) => {
      'id': s['student_id']?.toString() ?? '',
      'name': s['student_name']?.toString() ?? '',
      'template': s['template']?.toString() ?? '',
    }).toList();
  }

  Future<void> registerFingerprint(String studentId, String template) async {
    await _post('fingerprint/register/$studentId/', {'fingerprint_template': template});
  }

  Future<List<Map<String, String>>> getCohortFingerprintTemplates() async {
    final data = await _get('fingerprint/cohort-templates/');
    final students = data['students'] as List? ?? [];
    return students.map<Map<String, String>>((s) => {
      'id': s['id']?.toString() ?? '',
      'name': s['name']?.toString() ?? '',
      'template': s['template']?.toString() ?? '',
    }).toList();
  }

  // ── Students ──────────────────────────────────────────────────────────────

  Future<List<Student>> getStudents({String? search, String? courseId, String? cohortId, String? studyTime}) async {
    final params = <String, String>{'role': 'student'};
    if (search != null) params['search'] = search;
    if (courseId != null && courseId.isNotEmpty) params['course'] = courseId;
    if (cohortId != null && cohortId.isNotEmpty) params['cohort'] = cohortId;
    if (studyTime != null && studyTime.isNotEmpty) params['study_time'] = studyTime;
    final data = await _get('admin/users/', params);
    final results = data['results'] ?? data;
    return (results as List).map((s) => Student.fromJson(s)).toList();
  }
}
