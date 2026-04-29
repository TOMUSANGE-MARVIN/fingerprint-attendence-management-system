import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/token_manager.dart';
import '../models/models.dart';
import 'attendance_screen.dart';
import 'enrollment_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Course> _courses = [];
  CoordinatorResponse? _coordData;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final tm = context.read<TokenManager>();
    final api = ApiService(baseUrl: tm.baseUrl, token: tm.accessToken);
    try {
      if (tm.userRole == 'lecturer' || tm.userRole == 'admin') {
        final courses = await api.getCourses();
        setState(() { _courses = courses; });
      } else {
        // Students may be class coordinators — check first
        final coordData = await api.getCoordinatorData();
        if (coordData.isCoordinator) {
          setState(() { _coordData = coordData; _courses = coordData.courses; });
          // Always refresh cohort + study_time from /auth/me/ so filters work
          final me = await api.getMe();
          final role = (me['role'] ?? tm.userRole).toString().trim().toLowerCase();
          await tm.saveUserInfo(
            tm.userId, tm.userName, role,
            cohortId: me['cohort']?.toString() ?? coordData.cohort?.id ?? '',
            studyTime: me['study_time']?.toString() ?? '',
          );
        } else {
          setState(() => _error = 'This app is for lecturers and class coordinators only.');
        }
      }
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        _logout();
        return;
      }
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Network error. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    final tm = context.read<TokenManager>();
    await tm.clear();
    if (!mounted) return;
    Navigator.pushReplacement(
        context, MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.watch<TokenManager>();
    final firstName = tm.userName.split(' ').first;
    final role = tm.userRole.trim().toLowerCase();
    final roleLabel = role == 'student'
        ? ((_coordData?.isCoordinator ?? false) ? 'Student Coordinator' : 'Student')
        : (role == 'admin' ? 'Admin' : 'Lecturer');

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F0),
      body: RefreshIndicator(
        onRefresh: _load,
        color: const Color(0xFF2E7D32),
        child: CustomScrollView(
          slivers: [
            // App bar
            SliverAppBar(
              expandedHeight: 160,
              pinned: true,
              backgroundColor: const Color(0xFF2E7D32),
              actions: [
                IconButton(
                icon: const Icon(Icons.fingerprint, color: Colors.white),
                onPressed: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const EnrollmentScreen())),
                tooltip: 'Enroll Fingerprint',
              ),
              IconButton(
                  icon: const Icon(Icons.logout, color: Colors.white),
                  onPressed: _logout,
                  tooltip: 'Logout',
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF1B5E20), Color(0xFF43A047)],
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundColor: Colors.white.withOpacity(0.2),
                                child: Text(
                                  firstName.isNotEmpty ? firstName[0].toUpperCase() : 'U',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Hi, $firstName',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold)),
                                    Text(
                                      roleLabel,
                                      style: TextStyle(
                                          color: Colors.white.withOpacity(0.8),
                                          fontSize: 13),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Stat row
                          Row(
                            children: [
                              _StatChip(
                                icon: Icons.menu_book_rounded,
                                label: '${_courses.length} Courses',
                              ),
                              if (_coordData?.cohort != null) ...[
                                const SizedBox(width: 8),
                                _StatChip(
                                  icon: Icons.people_rounded,
                                  label: _coordData!.cohort!.currentSemesterLabel != null
                                      ? '${_coordData!.cohort!.name} · ${_coordData!.cohort!.currentSemesterLabel}'
                                      : _coordData!.cohort!.name,
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Body
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: Color(0xFF2E7D32))),
              )
            else if (_error != null)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.wifi_off_rounded, size: 56, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: Colors.grey[600])),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                        style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF2E7D32)),
                      ),
                    ],
                  ),
                ),
              )
            else if (_courses.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.school_outlined, size: 56, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text('No courses assigned',
                          style: TextStyle(color: Colors.grey[600])),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index == 0) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text('My Courses',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey[800])),
                        );
                      }
                      return _CourseCard(
                        course: _courses[index - 1],
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                AttendanceScreen(course: _courses[index - 1]),
                          ),
                        ),
                      );
                    },
                    childCount: _courses.length + 1,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.18),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final Course course;
  final VoidCallback onTap;
  const _CourseCard({required this.course, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.menu_book_rounded,
                    color: Color(0xFF2E7D32), size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(course.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _tag(course.code, const Color(0xFF2E7D32)),
                        if (course.department.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          _tag(course.department, Colors.blueGrey),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.people_outline,
                            size: 14, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text('${course.totalStudents} students',
                            style: const TextStyle(
                                fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tag(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      );
}
