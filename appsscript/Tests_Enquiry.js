/**
 * Transport & Logistics Management System (TMS)
 * Phase 6 - Enquiry Logic GAS Test Suite
 */

function testEnquirySuite() {
  const suiteName = 'Enquiry Logic & Lifecycle Suite';
  Logger.log('Starting ' + suiteName + '...');

  // Ensure test operator session exists
  const scriptProps = PropertiesService.getScriptProperties();
  const testPassword = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';
  const loginRes = AuthModule.login({ email: 'admin@tms.local', password: testPassword });
  const token = loginRes.token;

  // Ensure seed companies & clients exist
  const companies = SheetRepo.getAllRows('companies', false);
  const clients = SheetRepo.getAllRows('clients', false);
  const testCompanyId = companies.length > 0 ? companies[0].id : 'CMP-001';
  const testClientId = clients.length > 0 ? clients[0].id : 'CLI-201';

  // 1. Test Rapid-Fire Consecutive Creation & LockService Numbering
  TestHarness.test('Enquiry: Rapid-fire consecutive numbering under LockService', function () {
    const res1 = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Export',
      freightAmount: 25000,
    }, token);

    const res2 = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Import',
      freightAmount: 30000,
    }, token);

    const num1 = parseInt(res1.enquiry.enquiryNumber, 10);
    const num2 = parseInt(res2.enquiry.enquiryNumber, 10);

    TestHarness.assertEqual(num2, num1 + 1, 'Consecutive enquiries must have incremented sequential enquiry numbers');
    TestHarness.assert(res1.enquiry.transactionNumber !== res2.enquiry.transactionNumber, 'Transaction numbers must be unique');

    const fy = getFinancialYear();
    TestHarness.assert(res1.enquiry.transactionNumber.startsWith('TXN/' + fy + '/'), 'TXN number must have current FY');
    TestHarness.assertEqual(res1.movement.enquiryId, res1.enquiry.id, 'Linked movement row must have matching enquiryId');
  });

  // 2. Test Asset Find-or-Create (D12)
  TestHarness.test('Enquiry: Find-or-create vehicle, driver, container with D12 validation', function () {
    const randomSuffix = Math.floor(1000 + Math.random() * 8999);
    const rawVeh = 'tn04ab' + randomSuffix;
    const rawDriverPhone = '98' + Math.floor(10000000 + Math.random() * 89999999);
    const rawContainer = 'MSCU' + Math.floor(1000000 + Math.random() * 8999999);

    const res = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Export',
      vehicleNumber: rawVeh,
      driverName: 'Driver ' + randomSuffix,
      driverPhone: rawDriverPhone,
      containerNumber: rawContainer,
    }, token);

    TestHarness.assert(Boolean(res.enquiry.vehicleId), 'Vehicle should be resolved or created');
    TestHarness.assert(Boolean(res.enquiry.driverId), 'Driver should be resolved or created');
    TestHarness.assert(Boolean(res.enquiry.containerId), 'Container should be resolved or created');

    const createdVeh = SheetRepo.getRowById('vehicles', res.enquiry.vehicleId);
    TestHarness.assertEqual(createdVeh.vehicleNumber, rawVeh.toUpperCase(), 'Vehicle number must be auto-uppercased');
  });

  // 3. Test 7-Stage State Machine & Prerequisite Rules
  TestHarness.test('Enquiry: Stage flow and prerequisite enforcement', function () {
    // A. Create enquiry without vehicle or driver
    const res = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Import',
    }, token);

    const enqId = res.enquiry.id;

    // Try to jump to VEHICLE_ASSIGNED without vehicle/driver -> must throw
    TestHarness.assertThrows(function () {
      EnquiryModule.moveStage(enqId, 'VEHICLE_ASSIGNED', 'Trying to jump', token);
    }, 'Moving to VEHICLE_ASSIGNED without vehicle and driver must fail');

    // Assign vehicle and driver
    const veh = SheetRepo.getAllRows('vehicles', false)[0];
    const drv = SheetRepo.getAllRows('drivers', false)[0];
    EnquiryModule.update(enqId, { vehicleId: veh.id, driverId: drv.id }, token);

    // Now move to VEHICLE_ASSIGNED -> must succeed
    const moveRes1 = EnquiryModule.moveStage(enqId, 'VEHICLE_ASSIGNED', 'Assigned assets', token);
    TestHarness.assertEqual(moveRes1.enquiry.stage, 'VEHICLE_ASSIGNED', 'Stage should be VEHICLE_ASSIGNED');

    // Try to jump directly to COMPLETED (skipping CONTAINER_MOVEMENT & PORT_MOVEMENT) -> must throw
    TestHarness.assertThrows(function () {
      EnquiryModule.moveStage(enqId, 'COMPLETED', 'Skip to complete', token);
    }, 'Skipping stages must fail');

    // Try to move to BILLING or PROCESSED directly -> must throw
    TestHarness.assertThrows(function () {
      EnquiryModule.moveStage(enqId, 'BILLING', 'Jump to billing', token);
    }, 'Direct move to BILLING must be blocked');

    TestHarness.assertThrows(function () {
      EnquiryModule.moveStage(enqId, 'PROCESSED', 'Jump to processed', token);
    }, 'Direct move to PROCESSED must be blocked');
  });

  // 4. Test Movement Timestamp Chronological Validation (D13)
  TestHarness.test('Enquiry: Movement time order validation (out >= in)', function () {
    const res = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Export',
    }, token);

    const enqId = res.enquiry.id;

    // Out time earlier than in time -> must throw
    TestHarness.assertThrows(function () {
      EnquiryModule.updateMovement(enqId, {
        companyInTime: '21-09-2026 14:00',
        companyOutTime: '21-09-2026 12:00', // 2 hours earlier!
      }, token);
    }, 'Gate-out time earlier than gate-in time must be rejected');

    // Valid chronological times -> must succeed
    const validMov = EnquiryModule.updateMovement(enqId, {
      companyInTime: '21-09-2026 10:00 AM',
      companyOutTime: '21-09-2026 02:00 PM',
    }, token);

    TestHarness.assertEqual(validMov.companyInTime, '21-09-2026 10:00 AM', 'Valid in time saved');
    TestHarness.assertEqual(validMov.companyOutTime, '21-09-2026 02:00 PM', 'Valid out time saved');
  });

  // 5. Test Soft Delete Protection when in a bill
  TestHarness.test('Enquiry: Delete protection when linked to bill', function () {
    const res = EnquiryModule.create({
      companyId: testCompanyId,
      clientId: testClientId,
      loadingType: 'Export',
    }, token);

    const enqId = res.enquiry.id;

    // Simulate attached billId
    EnquiryModule.update(enqId, { billId: 'BILL-999' }, token);

    TestHarness.assertThrows(function () {
      EnquiryModule.delete(enqId, token);
    }, 'Deleting an enquiry with an attached billId must be blocked');

    // Clear billId and delete -> must succeed
    EnquiryModule.update(enqId, { billId: '' }, token);
    const delRes = EnquiryModule.delete(enqId, token);
    TestHarness.assertEqual(delRes.success, true, 'Soft delete should succeed when unbilled');
  });

  // 6. Test Vendor Payable Calculation (D7)
  TestHarness.test('Enquiry: computeVendorPayable formula verification', function () {
    const sample = {
      advanceAmount: 10000,
      extraAdvance: 2000,
      dieselAmount: 8000,
      haltingAmount: 1500,
      bonus: 500,
    };
    const calc = computeVendorPayable(sample);
    // 10000 + 2000 + 8000 + 1500 + 500 = 22000
    TestHarness.assertEqual(calc.totalPayable, 22000, 'Total payable must equal sum of 5 components');
  });
}
