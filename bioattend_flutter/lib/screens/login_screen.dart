import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/token_manager.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    final tm = context.read<TokenManager>();
    try {
      final api = ApiService(baseUrl: tm.baseUrl);
      final res = await api.login(_emailCtrl.text.trim(), _passwordCtrl.text);
      await tm.saveTokens(res.access, res.refresh);
      // Fetch full profile to get study_time and cohort
      final authedApi = ApiService(baseUrl: tm.baseUrl, token: res.access);
      final me = await authedApi.getMe();
      final role = (me['role'] ?? res.role).toString().trim().toLowerCase();
      await tm.saveUserInfo(
        res.userId, res.userName, role,
        cohortId: me['cohort']?.toString() ?? '',
        studyTime: me['study_time']?.toString() ?? '',
      );
      if (!mounted) return;
      Navigator.pushReplacement(context,
          MaterialPageRoute(builder: (_) => const DashboardScreen()));
    } on ApiException catch (e) {
      setState(() => _error = e.statusCode == 401
          ? 'Invalid email or password'
          : e.message);
    } catch (_) {
      setState(() => _error = 'Network error. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showServerDialog() async {
    final tm = context.read<TokenManager>();
    final ctrl = TextEditingController(text: tm.baseUrl);
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Server URL'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Base URL',
            hintText: 'http://192.168.1.100:8000/api/',
          ),
          keyboardType: TextInputType.url,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await tm.saveBaseUrl(ctrl.text.trim());
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final green = const Color(0xFF2E7D32);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1B5E20), Color(0xFF2E7D32), Color(0xFF43A047)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                children: [
                  // Logo area
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(Icons.fingerprint, size: 48, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  const Text('BioAttend',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold,
                          color: Colors.white, letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text('Biometric Attendance System',
                      style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.75))),
                  const SizedBox(height: 36),

                  // Card
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    elevation: 8,
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text('Sign In',
                                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('Enter your credentials to continue',
                                style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                            const SizedBox(height: 24),

                            if (_error != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red[50],
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.red[200]!),
                                ),
                                child: Row(children: [
                                  Icon(Icons.error_outline, color: Colors.red[700], size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text(_error!,
                                      style: TextStyle(color: Colors.red[700], fontSize: 13))),
                                ]),
                              ),
                              const SizedBox(height: 16),
                            ],

                            TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                labelText: 'Email',
                                prefixIcon: const Icon(Icons.email_outlined),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              validator: (v) => v!.isEmpty ? 'Email is required' : null,
                            ),
                            const SizedBox(height: 16),

                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: _obscure,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon: const Icon(Icons.lock_outlined),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              validator: (v) => v!.isEmpty ? 'Password is required' : null,
                              onFieldSubmitted: (_) => _login(),
                            ),
                            const SizedBox(height: 24),

                            FilledButton(
                              onPressed: _loading ? null : _login,
                              style: FilledButton.styleFrom(
                                backgroundColor: green,
                                minimumSize: const Size.fromHeight(50),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                              child: _loading
                                  ? const SizedBox(width: 20, height: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.white))
                                  : const Text('Sign In',
                                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Server URL
                  TextButton.icon(
                    onPressed: _showServerDialog,
                    icon: const Icon(Icons.dns_outlined, color: Colors.white70, size: 16),
                    label: Consumer<TokenManager>(
                      builder: (_, tm, __) => Text(tm.baseUrl,
                          style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
