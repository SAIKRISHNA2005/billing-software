/**
 * Transport & Logistics Management System (TMS)
 * Phase 12 — Billing Unit Tests
 */

function runBillingTests() {
  Logger.log('=== Running Phase 12: Billing Tests ===');

  // Test 1: Pending list returns unbilled completed enquiries
  var pendingResult = BillingModule.listPending();
  Tests_Harness.assertNotEqual(pendingResult.items, null, 'Pending list should return array');

  // Create a mock completed enquiry if list is empty
  var enquiryId = 'ENQ-TEST-BILL';
  var companyId = 'CMP-TEST';
  var clientId = 'CLT-TEST';

  SheetRepoModule.insertRow('enquiries', {
    id: enquiryId,
    transactionNo: 'TXN/2026-27/99999',
    companyId: companyId,
    clientId: clientId,
    stage: 'COMPLETED',
    freightAmount: 15000,
    haltingAmount: 2000,
    billId: '',
    createdAt: new Date().toISOString()
  });

  // Test 2: Create Draft Bill
  var draft = BillingModule.createBill({
    companyId: companyId,
    clientId: clientId,
    enquiryIds: [enquiryId]
  });

  Tests_Harness.assertEqual(draft.status, 'DRAFT', 'Created bill should have status DRAFT');
  Tests_Harness.assertEqual(draft.totalAmount, 17000, 'Draft bill total should equal sum of freight + halting');

  // Verify enquiry stage updated to BILLING
  var enquiryAfterDraft = SheetRepoModule.getRowById('enquiries', enquiryId);
  Tests_Harness.assertEqual(enquiryAfterDraft.stage, 'BILLING', 'Enquiry stage should advance to BILLING');

  // Test 3: Process Bill allocates FY sequence number
  var processed = BillingModule.processBill({
    id: draft.id,
    billingDate: '15-05-2026'
  });

  Tests_Harness.assertEqual(processed.status, 'PROCESSED', 'Processed bill status should be PROCESSED');
  Tests_Harness.assertTrue(processed.billNumber.indexOf('/2026-27') !== -1, 'Bill number should include /2026-27');
  Tests_Harness.assertTrue(processed.billSeq > 0, 'Bill sequence should be positive integer');

  // Verify enquiry stage updated to PROCESSED
  var enquiryAfterProcess = SheetRepoModule.getRowById('enquiries', enquiryId);
  Tests_Harness.assertEqual(enquiryAfterProcess.stage, 'PROCESSED', 'Enquiry stage should advance to PROCESSED');

  // Test 4: Cannot process an already processed bill
  Tests_Harness.assertThrows(function () {
    BillingModule.processBill({ id: draft.id });
  }, 'Should throw error when processing already processed bill');

  // Clean up test data
  SheetRepoModule.deleteRow('enquiries', enquiryId);
  SheetRepoModule.deleteRow('bills', draft.id);

  Logger.log('=== Billing Tests Completed ===');
}

if (typeof module !== 'undefined') {
  module.exports = { runBillingTests: runBillingTests };
}
