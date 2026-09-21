/**
 * Transport & Logistics Management System (TMS)
 * Phase 3 - Apps Script Custom Assertion & Testing Harness
 */

const TestHarness = {
  results: [],

  reset() {
    this.results = [];
  },

  assertEqual(actual, expected, testName) {
    const passed = actual === expected;
    this.results.push({
      testName: testName || 'assertEqual',
      passed,
      expected: String(expected),
      actual: String(actual),
      message: passed ? 'Passed' : `Expected "${expected}" but got "${actual}"`,
    });
    if (!passed) {
      Logger.log(`❌ FAIL: ${testName} | Expected: ${expected} | Actual: ${actual}`);
    } else {
      Logger.log(`✅ PASS: ${testName}`);
    }
  },

  assertTrue(condition, testName) {
    const passed = Boolean(condition) === true;
    this.results.push({
      testName: testName || 'assertTrue',
      passed,
      expected: 'true',
      actual: String(condition),
      message: passed ? 'Passed' : `Expected condition to be true, got ${condition}`,
    });
    if (!passed) {
      Logger.log(`❌ FAIL: ${testName} | Condition was not true`);
    } else {
      Logger.log(`✅ PASS: ${testName}`);
    }
  },

  assertFalse(condition, testName) {
    const passed = Boolean(condition) === false;
    this.results.push({
      testName: testName || 'assertFalse',
      passed,
      expected: 'false',
      actual: String(condition),
      message: passed ? 'Passed' : `Expected condition to be false, got ${condition}`,
    });
    if (!passed) {
      Logger.log(`❌ FAIL: ${testName} | Condition was not false`);
    } else {
      Logger.log(`✅ PASS: ${testName}`);
    }
  },

  writeResultsToSheet() {
    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!spreadsheetId) return;

      const ss = SpreadsheetApp.openById(spreadsheetId);
      let sheet = ss.getSheetByName('TestResults');
      if (!sheet) {
        sheet = ss.insertSheet('TestResults');
        sheet
          .getRange(1, 1, 1, 5)
          .setValues([['Timestamp', 'Test Name', 'Status', 'Expected', 'Actual']]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#e5e7eb');
      }

      const timestamp = new Date().toISOString();
      const rows = this.results.map((r) => [
        timestamp,
        r.testName,
        r.passed ? 'PASS' : 'FAIL',
        r.expected,
        r.actual,
      ]);

      if (rows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
      }
    } catch (e) {
      Logger.log('Could not write test results to sheet: ' + e.message);
    }
  },
};

/**
 * Top-level function to run all Apps Script test suites
 */
function runAllTests() {
  TestHarness.reset();

  Logger.log('========================================');
  Logger.log('🚀 RUNNING TMS APPS SCRIPT TEST SUITE');
  Logger.log('========================================');

  // 1. Run Financial Year Tests
  if (typeof testFinancialYearSuite === 'function') {
    testFinancialYearSuite();
  }

  // 2. Run SheetRepo Basic Tests
  if (typeof testSheetRepoSuite === 'function') {
    testSheetRepoSuite();
  }

  TestHarness.writeResultsToSheet();

  const total = TestHarness.results.length;
  const passed = TestHarness.results.filter((r) => r.passed).length;
  const failed = total - passed;

  Logger.log('========================================');
  Logger.log(`🏁 TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  Logger.log('========================================');

  return {
    success: failed === 0,
    total,
    passed,
    failed,
    results: TestHarness.results,
  };
}
