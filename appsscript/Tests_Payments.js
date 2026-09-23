/**
 * Transport & Logistics Management System (TMS)
 * Phase 15 - Payments Module Test Suite
 */

function testPaymentsSuite() {
  TestHarness.reset();

  // Test 1: Ageing report computation
  try {
    const report = PaymentsModule.ageing();
    TestHarness.assert(
      report && typeof report.summary === 'object' && Array.isArray(report.clients),
      'PaymentsModule.ageing returns summary object and clients array'
    );
  } catch (err) {
    TestHarness.assert(false, 'PaymentsModule.ageing threw error: ' + err.message);
  }
}
