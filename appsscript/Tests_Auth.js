/**
 * Transport & Logistics Management System (TMS)
 * Auth & Session Test Suite
 */

function testAuthSuite() {
  Logger.log('--- Testing Authentication & Sessions ---');

  const testEmail = 'admin@tms.local';
  const scriptProps = PropertiesService.getScriptProperties();
  const testPassword = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';

  // 1. Test Login Success
  let loginResult;
  try {
    loginResult = AuthModule.login({ email: testEmail, password: testPassword });
    TestHarness.assertTrue(Boolean(loginResult && loginResult.token), 'Login success returns token');
    TestHarness.assertEqual(loginResult.user.email, testEmail, 'Login returns user email');
  } catch (e) {
    TestHarness.assertTrue(false, 'Login with valid credentials threw error: ' + e.message);
  }

  // 2. Test Me (Validate Session)
  if (loginResult && loginResult.token) {
    try {
      const meResult = AuthModule.me(loginResult.token);
      TestHarness.assertEqual(meResult.user.email, testEmail, 'Me returns correct user profile');
    } catch (e) {
      TestHarness.assertTrue(false, 'Me threw error: ' + e.message);
    }
  }

  // 3. Test Wrong Password
  let wrongPassFailed = false;
  try {
    AuthModule.login({ email: testEmail, password: 'WrongPassword999!' });
  } catch (e) {
    wrongPassFailed = true;
  }
  TestHarness.assertTrue(wrongPassFailed, 'Login with wrong password is rejected');

  // 4. Test Expired / Invalid Session Rejected
  let invalidSessionRejected = false;
  try {
    requireSession('non_existent_fake_token_123');
  } catch (e) {
    invalidSessionRejected = e.code === 'UNAUTHORIZED' || e.message.includes('Session');
  }
  TestHarness.assertTrue(invalidSessionRejected, 'Fake session token is rejected');

  // 5. Test Logout
  if (loginResult && loginResult.token) {
    AuthModule.logout(loginResult.token);
    let sessionAfterLogoutRejected = false;
    try {
      requireSession(loginResult.token);
    } catch (e) {
      sessionAfterLogoutRejected = true;
    }
    TestHarness.assertTrue(sessionAfterLogoutRejected, 'Session is invalidated after logout');
  }

  // 6. Test Rate Limiting Lockout
  Logger.log('Testing rate-limit lockout logic...');
  const cache = CacheService.getScriptCache();
  const lockoutEmail = 'test_rate_limit@tms.local';
  const attemptsKey = 'attempts_' + lockoutEmail;
  const lockoutKey = 'lockout_' + lockoutEmail;

  cache.remove(attemptsKey);
  cache.remove(lockoutKey);

  // Simulate 5 failed attempts
  for (let i = 1; i <= 5; i++) {
    try {
      AuthModule.login({ email: lockoutEmail, password: 'wrong' });
    } catch (e) {
      // Expected failure
    }
  }

  const isLocked = Boolean(cache.get(lockoutKey));
  TestHarness.assertTrue(isLocked, 'Account is locked out after 5 consecutive failures');

  // Clean up cache
  cache.remove(attemptsKey);
  cache.remove(lockoutKey);
}
