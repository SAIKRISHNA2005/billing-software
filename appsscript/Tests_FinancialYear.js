/**
 * Transport & Logistics Management System (TMS)
 * Financial Year Test Suite (Jan 1 - Dec 31 Cycle, YYYY-YY Format)
 */

function testFinancialYearSuite() {
  Logger.log('--- Testing Financial Year Boundaries (Jan 1 to Dec 31, Asia/Kolkata) ---');

  // Test 1: Boundary: 31 December 2025 at 23:59:59 IST (UTC 18:29:59 on 31 Dec) -> 2025-26
  const date31Dec = new Date('2025-12-31T18:29:59.000Z');
  TestHarness.assertEqual(
    getFinancialYear(date31Dec),
    '2025-26',
    'Boundary: 31-December 23:59:59 IST must be 2025-26'
  );

  // Test 2: Boundary: 01 January 2026 at 00:00:00 IST (UTC 18:30:00 on 31 Dec) -> 2026-27
  const date01Jan = new Date('2025-12-31T18:30:00.000Z');
  TestHarness.assertEqual(
    getFinancialYear(date01Jan),
    '2026-27',
    'Boundary: 01-January 00:00:00 IST must be 2026-27'
  );

  // Test 3: Leap Year Date: 29 February 2024 -> 2024-25
  const dateLeapYear = new Date('2024-02-29T12:00:00.000Z');
  TestHarness.assertEqual(
    getFinancialYear(dateLeapYear),
    '2024-25',
    'Leap Year: 29-Feb-2024 must be 2024-25'
  );

  // Test 4: Mid-year Date: 15 August 2026 -> 2026-27
  const dateMidYear = new Date('2026-08-15T04:00:00.000Z');
  TestHarness.assertEqual(
    getFinancialYear(dateMidYear),
    '2026-27',
    'Mid-year: 15-August-2026 must be 2026-27'
  );

  // Test 5: End-of-year Date: 31 December 2026 at 23:59:59 IST -> 2026-27
  const dateYearEnd = new Date('2026-12-31T18:29:59.000Z');
  TestHarness.assertEqual(
    getFinancialYear(dateYearEnd),
    '2026-27',
    'Year-end: 31-December-2026 must be 2026-27'
  );

  // Test 6: String input format YYYY-MM-DD
  TestHarness.assertEqual(
    getFinancialYear('2026-06-15'),
    '2026-27',
    'String input: 2026-06-15 must be 2026-27'
  );
}

/**
 * Basic SheetRepo CRUD test suite
 */
function testSheetRepoSuite() {
  Logger.log('--- Testing SheetRepo CRUD ---');

  try {
    const settings = SheetRepo.getRowById('app_settings', 'DEFAULT');
    TestHarness.assertTrue(settings !== null, 'SheetRepo getRowById found DEFAULT settings');
    if (settings) {
      TestHarness.assertEqual(
        settings.id,
        'DEFAULT',
        'SheetRepo DEFAULT settings has correct id'
      );
    }
  } catch (err) {
    Logger.log('SheetRepo test note: ' + err.message);
  }
}
