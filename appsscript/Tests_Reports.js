/**
 * Transport & Logistics Management System (TMS)
 * Phase 16 — Reports Unit Tests
 */

function runReportsTests() {
  Logger.log('=== Running Phase 16: Reports Tests ===');

  // Test 1: Daily Report calculates valid object structure
  var daily = ReportsModule.getDailyReport();
  Tests_Harness.assertNotEqual(daily, null, 'Daily report should not be null');
  Tests_Harness.assertEqual(typeof daily.totalEnquiries, 'number', 'totalEnquiries should be a number');
  Tests_Harness.assertEqual(typeof daily.totalBilling, 'number', 'totalBilling should be a number');
  Tests_Harness.assertEqual(typeof daily.totalExpenses, 'number', 'totalExpenses should be a number');

  // Test 2: Company Report returns items and totals
  var companyReport = ReportsModule.getCompanyReport();
  Tests_Harness.assertNotEqual(companyReport.items, null, 'Company report items should not be null');
  Tests_Harness.assertEqual(typeof companyReport.totals.totalTrips, 'number', 'Company totals totalTrips should be a number');

  // Test 3: Billing Report returns totals
  var billingReport = ReportsModule.getBillingReport();
  Tests_Harness.assertNotEqual(billingReport.items, null, 'Billing report items should not be null');
  Tests_Harness.assertEqual(typeof billingReport.totals.totalBilled, 'number', 'Billing totals totalBilled should be a number');

  Logger.log('=== Reports Tests Completed ===');
}

if (typeof module !== 'undefined') {
  module.exports = { runReportsTests: runReportsTests };
}
