/**
 * Transport & Logistics Management System (TMS)
 * Phase 14 - PDF Generation Test Suite
 */

function testPdfSuite() {
  TestHarness.reset();

  // Test 1: Number to words conversion
  try {
    const words1 = PDFModule.numberToWordsINR(185000);
    TestHarness.assert(
      words1.includes('Rupees One Lakh Eighty Five Thousand Only'),
      'numberToWordsINR formats 1,85,000 correctly'
    );

    const words2 = PDFModule.numberToWordsINR(0);
    TestHarness.assert(
      words2 === 'Zero Rupees Only',
      'numberToWordsINR handles 0 correctly'
    );
  } catch (err) {
    TestHarness.assert(false, 'numberToWordsINR threw error: ' + err.message);
  }
}
