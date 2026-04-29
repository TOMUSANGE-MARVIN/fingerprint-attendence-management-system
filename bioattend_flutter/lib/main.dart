import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/token_manager.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final tm = await TokenManager.create();
  // If token is empty (corrupted old session), force fresh login
  if (tm.isLoggedIn && tm.accessToken.trim().isEmpty) {
    await tm.clear();
  }
  runApp(
    ChangeNotifierProvider.value(
      value: tm,
      child: const BioAttendApp(),
    ),
  );
}

class BioAttendApp extends StatelessWidget {
  const BioAttendApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BioAttend',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2E7D32),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF2E7D32),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      home: Consumer<TokenManager>(
        builder: (_, tm, __) =>
            tm.isLoggedIn ? const DashboardScreen() : const LoginScreen(),
      ),
    );
  }
}
