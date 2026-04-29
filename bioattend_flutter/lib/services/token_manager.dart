import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TokenManager extends ChangeNotifier {
  static const _keyAccess = 'access_token';
  static const _keyRefresh = 'refresh_token';
  static const _keyUserName = 'user_name';
  static const _keyUserRole = 'user_role';
  static const _keyUserId = 'user_id';
  static const _keyBaseUrl = 'base_url';
  static const _keyCohortId = 'cohort_id';
  static const _keyStudyTime = 'study_time';
  static const _defaultBaseUrl = 'http://192.168.1.100:8000/api/';

  final SharedPreferences _prefs;

  TokenManager(this._prefs);

  static Future<TokenManager> create() async {
    final prefs = await SharedPreferences.getInstance();
    return TokenManager(prefs);
  }

  String get accessToken => _prefs.getString(_keyAccess) ?? '';
  String get refreshToken => _prefs.getString(_keyRefresh) ?? '';
  String get userName => _prefs.getString(_keyUserName) ?? '';
  String get userRole => _prefs.getString(_keyUserRole) ?? '';
  String get userId => _prefs.getString(_keyUserId) ?? '';
  String get baseUrl => _prefs.getString(_keyBaseUrl) ?? _defaultBaseUrl;
  String get cohortId => _prefs.getString(_keyCohortId) ?? '';
  String get studyTime => _prefs.getString(_keyStudyTime) ?? '';
  bool get isLoggedIn => accessToken.isNotEmpty;

  Future<void> saveTokens(String access, String refresh) async {
    await _prefs.setString(_keyAccess, access);
    await _prefs.setString(_keyRefresh, refresh);
    notifyListeners();
  }

  Future<void> saveUserInfo(String userId, String userName, String role,
      {String cohortId = '', String studyTime = ''}) async {
    final normalizedRole = role.trim().toLowerCase();
    await _prefs.setString(_keyUserId, userId);
    await _prefs.setString(_keyUserName, userName);
    await _prefs.setString(_keyUserRole, normalizedRole);
    if (cohortId.isNotEmpty) await _prefs.setString(_keyCohortId, cohortId);
    if (studyTime.isNotEmpty) await _prefs.setString(_keyStudyTime, studyTime);
    notifyListeners();
  }

  Future<void> saveBaseUrl(String url) async {
    await _prefs.setString(_keyBaseUrl, url);
    notifyListeners();
  }

  Future<void> clear() async {
    await _prefs.clear();
    notifyListeners();
  }
}
