/**
 * Transport & Logistics Management System (TMS)
 * Phase 11 — Settings Unit Tests
 */

function runSettingsTests() {
  Logger.log('=== Running Phase 11: Settings Tests ===');

  // Test 1: Get settings returns valid default object
  var settings = SettingsModule.getSettings();
  Tests_Harness.assertNotEqual(settings, null, 'Settings object should not be null');
  Tests_Harness.assertEqual(typeof settings.companyName, 'string', 'Company name should be a string');
  Tests_Harness.assertEqual(typeof settings.enquiryStartNumber, 'number', 'Enquiry start number should be a number');

  // Test 2: Update settings updates fields and writes audit log
  var updated = SettingsModule.updateSettings({
    companyName: 'TEST LOGISTICS LTD',
    enquiryStartNumber: 20001
  });
  Tests_Harness.assertEqual(updated.companyName, 'TEST LOGISTICS LTD', 'Company name should update');
  Tests_Harness.assertEqual(updated.enquiryStartNumber, 20001, 'Enquiry start number should update');

  // Test 3: Invalid enquiry start number throws error
  Tests_Harness.assertThrows(function () {
    SettingsModule.updateSettings({ enquiryStartNumber: -100 });
  }, 'Invalid enquiry start number should throw error');

  // Test 4: Upload and Remove Seal
  var sealResult = SettingsModule.uploadSeal({ base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' });
  Tests_Harness.assertNotEqual(sealResult.sealFileId, '', 'Seal file ID should be set');
  var removeSealResult = SettingsModule.removeSeal();
  Tests_Harness.assertEqual(removeSealResult.sealFileId, '', 'Seal file ID should be cleared');

  // Test 5: Next Bill Number Preview
  var preview = SettingsModule.previewNextBillNumber('15-05-2026');
  Tests_Harness.assertEqual(preview.financialYear, '2026-27', 'Financial year preview should be 2026-27');
  Tests_Harness.assertEqual(typeof preview.nextBillNumber, 'string', 'Next bill number preview should be string');

  // Test 6: Audit log listing returns items
  var auditResult = SettingsModule.listAuditLogs({ entity: 'settings' });
  Tests_Harness.assertNotEqual(auditResult.items, null, 'Audit items should not be null');
  Tests_Harness.assertTrue(auditResult.items.length > 0, 'Should contain logged audit entries');

  Logger.log('=== Settings Tests Completed ===');
}

if (typeof module !== 'undefined') {
  module.exports = { runSettingsTests: runSettingsTests };
}
