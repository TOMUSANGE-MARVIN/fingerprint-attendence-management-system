class LoginResponse {
  final String access;
  final String refresh;
  final String userId;
  final String userName;
  final String role;

  LoginResponse({
    required this.access,
    required this.refresh,
    required this.userId,
    required this.userName,
    required this.role,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> j) {
    final tokens = j['tokens'] as Map<String, dynamic>? ?? j;
    final user = j['user'] as Map<String, dynamic>? ?? j;
    final rawRole = user['role'] ?? j['role'] ?? '';
    return LoginResponse(
      access: tokens['access'] ?? '',
      refresh: tokens['refresh'] ?? '',
      userId: user['id']?.toString() ?? user['user_id']?.toString() ?? '',
      userName: '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim(),
      role: rawRole.toString().trim().toLowerCase(),
    );
  }
}

class Course {
  final String id;
  final String code;
  final String name;
  final String department;
  final int totalStudents;

  Course({
    required this.id,
    required this.code,
    required this.name,
    required this.department,
    required this.totalStudents,
  });

  factory Course.fromJson(Map<String, dynamic> j) => Course(
        id: (j['id'] ?? j['course_id'])?.toString() ?? '',
        code: j['code'] ?? j['course_code'] ?? '',
        name: j['name'] ?? j['course_name'] ?? '',
        department: j['department'] ?? j['programme_code'] ?? '',
        totalStudents: j['total_students'] ?? j['enrolled_students'] ?? 0,
      );
}

class AttendanceSession {
  final String id;
  final String courseId;
  final bool isActive;
  final String? startedAt;

  AttendanceSession({
    required this.id,
    required this.courseId,
    required this.isActive,
    this.startedAt,
  });

  factory AttendanceSession.fromJson(Map<String, dynamic> j) => AttendanceSession(
        id: j['id']?.toString() ?? '',
        courseId: j['course']?.toString() ?? '',
        isActive: j['is_active'] ?? false,
        startedAt: j['started_at'],
      );
}

class Student {
  final String id;
  final String firstName;
  final String lastName;
  final String studentId;
  final String email;

  Student({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.studentId,
    required this.email,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory Student.fromJson(Map<String, dynamic> j) => Student(
        id: j['id']?.toString() ?? '',
        firstName: j['first_name'] ?? '',
        lastName: j['last_name'] ?? '',
        studentId: j['student_id'] ?? '',
        email: j['email'] ?? '',
      );
}

class CohortInfo {
  final String id;
  final String name;
  final int? currentYearOfStudy;
  final String? currentSemesterLabel;

  CohortInfo({required this.id, required this.name, this.currentYearOfStudy, this.currentSemesterLabel});

  factory CohortInfo.fromJson(Map<String, dynamic> j) => CohortInfo(
        id: j['id']?.toString() ?? '',
        name: j['name'] ?? '',
        currentYearOfStudy: j['current_year_of_study'],
        currentSemesterLabel: j['current_semester_label'],
      );
}

class CoordinatorResponse {
  final bool isCoordinator;
  final CohortInfo? cohort;
  final List<Course> courses;
  final List<Student> students;

  CoordinatorResponse({
    required this.isCoordinator,
    this.cohort,
    required this.courses,
    required this.students,
  });

  factory CoordinatorResponse.fromJson(Map<String, dynamic> j) => CoordinatorResponse(
        isCoordinator: j['is_coordinator'] ?? false,
        cohort: j['cohort'] != null ? CohortInfo.fromJson(j['cohort']) : null,
        courses: (j['courses'] as List? ?? []).map((c) => Course.fromJson(c)).toList(),
        students: (j['students'] as List? ?? []).map((s) => Student.fromJson(s)).toList(),
      );
}

class FingerprintVerifyResponse {
  final bool success;
  final bool alreadyMarked;
  final String message;
  final Student? student;
  final String? studentId;
  final String? studentNumber;
  final String? studentName;
  final String? status;

  FingerprintVerifyResponse({
    required this.success,
    required this.alreadyMarked,
    required this.message,
    this.student,
    this.studentId,
    this.studentNumber,
    this.studentName,
    this.status,
  });

  factory FingerprintVerifyResponse.fromJson(Map<String, dynamic> j) {
    final status = (j['status'] ?? '').toString().toLowerCase();
    final matched = j['matched'] == true;
    final explicitSuccess = j['success'] == true;
    final alreadyMarked = j['already_marked'] == true;
    final statusSuccess = status == 'present' || status == 'late' || status == 'excused';
    final success = explicitSuccess || matched || statusSuccess;

    return FingerprintVerifyResponse(
      success: success,
      alreadyMarked: alreadyMarked,
      message: (j['message'] ?? '').toString(),
      student: j['student'] != null ? Student.fromJson(j['student']) : null,
      studentId: j['student_id']?.toString(),
      studentNumber: j['student_number']?.toString(),
      studentName: j['student_name']?.toString(),
      status: status.isEmpty ? null : status,
    );
  }
}
