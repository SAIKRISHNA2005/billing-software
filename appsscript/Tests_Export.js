/**
 * Transport & Logistics Management System (TMS)
 * Phase 17 — Export Unit Tests
 */

function runExportTests() {
  Logger.log('=== Running Phase 17: Export Tests ===');

  // Test 1: Report CSV Export returns non-empty string
  var csvResult = ExportModule.exportReportCsv({ report: 'enquiries' });
  Tests_Harness.assertNotEqual(csvResult, null, 'CSV result should not be null');
  Tests_Harness.assertTrue(csvResult.csvData.length > 0, 'CSV data should be non-empty string');
  Tests_Harness.assertTrue(csvResult.filename.indexOf('.csv') !== -1, 'Filename should end with .csv');

  Logger.log('=== Export Tests Completed ===');
}

if (typeof module !== 'undefined') {
  module.exports = { runExportTests: runExportTests };
}
