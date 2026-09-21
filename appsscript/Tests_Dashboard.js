/**
 * Transport & Logistics Management System (TMS)
 * Phase 18 — Dashboard Unit Tests
 */

function runDashboardTests() {
  Logger.log('=== Running Phase 18: Dashboard Tests ===');

  var summary = DashboardModule.getDashboardSummary();
  Tests_Harness.assertNotEqual(summary, null, 'Dashboard summary should not be null');
  Tests_Harness.assertEqual(typeof summary.todaysTrips, 'number', 'todaysTrips should be a number');
  Tests_Harness.assertEqual(typeof summary.todaysRevenue, 'number', 'todaysRevenue should be a number');
  Tests_Harness.assertNotEqual(summary.companyBillingChart, null, 'Chart items should not be null');

  Logger.log('=== Dashboard Tests Completed ===');
}

if (typeof module !== 'undefined') {
  module.exports = { runDashboardTests: runDashboardTests };
}
