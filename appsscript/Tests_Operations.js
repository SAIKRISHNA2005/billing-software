/**
 * Transport & Logistics Management System (TMS)
 * Phase 8 - Operations Test Suite (Tests_Operations.js)
 */

function testOperationsSuite() {
  Logger.log('--- Testing Operations Module Queries & Stage Filters ---');

  // Ensure test operator session exists
  const scriptProps = PropertiesService.getScriptProperties();
  const testPassword = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';
  const loginRes = AuthModule.login({ email: 'admin@tms.local', password: testPassword });
  const testToken = loginRes.token;

  // Resolve test company and client
  const companies = SheetRepo.getAllRows('companies', false);
  const clients = SheetRepo.getAllRows('clients', false);
  const testCompanyId = companies.length > 0 ? companies[0].id : 'CMP-001';
  const testClientId = clients.length > 0 ? clients[0].id : 'CLI-201';

  // 1. Test operations.movements action
  TestHarness.test('Operations: movements query returns active movement stages', () => {
    const res = EnquiryModule.operationsMovements({ page: 1, limit: 50 }, testToken);
    TestHarness.assert(Array.isArray(res.items), true, 'items should be an array');
    const validStages = ['VEHICLE_ASSIGNED', 'CONTAINER_MOVEMENT', 'PORT_MOVEMENT'];
    const allMatch = res.items.every((item) => validStages.includes(item.stage));
    TestHarness.assert(allMatch, true, 'All items must have a stage in active movement');
  });

  // 2. Test operations.pending action
  TestHarness.test('Operations: pending query returns all stages before COMPLETED', () => {
    const res = EnquiryModule.operationsPending({ page: 1, limit: 50 }, testToken);
    TestHarness.assert(Array.isArray(res.items), true, 'items should be an array');
    const nonPendingStages = ['COMPLETED', 'BILLING', 'PROCESSED'];
    const noneCompleted = res.items.every((item) => !nonPendingStages.includes(item.stage));
    TestHarness.assert(noneCompleted, true, 'No items in pending query should be completed or billed');
  });

  // 3. Test operations.completed action
  TestHarness.test('Operations: completed query returns COMPLETED or later stages', () => {
    const res = EnquiryModule.operationsCompleted({ page: 1, limit: 50 }, testToken);
    TestHarness.assert(Array.isArray(res.items), true, 'items should be an array');
    const completedStages = ['COMPLETED', 'BILLING', 'PROCESSED'];
    const allCompleted = res.items.every((item) => completedStages.includes(item.stage));
    TestHarness.assert(allCompleted, true, 'All items in completed query must be COMPLETED, BILLING, or PROCESSED');
  });

  // 4. Test quick updateMovement action
  TestHarness.test('Operations: quick updateMovement saves times and recalculates auto status', () => {
    // Create an enquiry first
    const seed = EnquiryModule.create(
      {
        companyId: testCompanyId,
        clientId: testClientId,
        loadingType: 'Import',
        vehicleNumber: 'TN05OP' + Math.floor(1000 + Math.random() * 9000),
        driverName: 'Op Driver',
        driverPhone: '98888' + Math.floor(10000 + Math.random() * 90000),
        containerNumber: 'MSCU' + Math.floor(1000000 + Math.random() * 9000000),
      },
      testToken
    );

    const enquiryId = seed.enquiry.id;
    const updatedMov = EnquiryModule.updateMovement(
      enquiryId,
      {
        companyInTime: '21-09-2026 10:00 AM',
        companyOutTime: '21-09-2026 11:30 AM',
        portInTime: '21-09-2026 01:00 PM',
        portOutTime: '21-09-2026 03:00 PM',
      },
      testToken
    );

    TestHarness.assert(updatedMov.movementStatus, 'MOVED', 'movementStatus should be auto-set to MOVED');
    TestHarness.assert(updatedMov.shippingStatus, 'COMPLETED', 'shippingStatus should be auto-set to COMPLETED');
  });
}
