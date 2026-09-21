/**
 * Transport & Logistics Management System (TMS)
 * Phase 9 - Expenses Test Suite (Tests_Expenses.js)
 */

function testExpensesSuite() {
  Logger.log('--- Testing Expenses Module & Auto-Sync (Rule D8) ---');

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

  // 1. Manual Loading Expense CRUD
  TestHarness.test('Expenses: Manual loading expense create, get, update, delete', () => {
    const created = ExpensesModule.createLoading(
      {
        expenseDate: '21-09-2026',
        category: 'Parking',
        amount: 250.5,
        description: 'Toll & Parking charges',
      },
      testToken
    );

    TestHarness.assert(typeof created.id === 'string' && created.id.startsWith('LEXP-'), true, 'ID must have LEXP- prefix');
    TestHarness.assert(created.source, 'MANUAL', 'Source must be MANUAL');
    TestHarness.assert(created.amount, 250.5, 'Amount should be 250.5');

    // Get
    const fetched = ExpensesModule.getLoading(created.id, testToken);
    TestHarness.assert(fetched.category, 'Parking', 'Fetched category must match');

    // Update
    const updated = ExpensesModule.updateLoading(created.id, { amount: 300, description: 'Updated parking' }, testToken);
    TestHarness.assert(updated.amount, 300, 'Updated amount should be 300');

    // Delete
    const delRes = ExpensesModule.deleteLoading(created.id, testToken);
    TestHarness.assert(delRes.deleted, true, 'Row should be deleted');
  });

  // 2. Manual General Expense CRUD & Totals
  TestHarness.test('Expenses: General expense create, get, update, list totals', () => {
    const created = ExpensesModule.createGeneral(
      {
        expenseDate: '21-09-2026',
        category: 'Office Stationery',
        amount: 500,
        description: 'Printer ink and paper',
      },
      testToken
    );

    TestHarness.assert(typeof created.id === 'string' && created.id.startsWith('GEXP-'), true, 'ID must have GEXP- prefix');
    TestHarness.assert(created.amount, 500, 'Amount should be 500');

    // List & check totals
    const listRes = ExpensesModule.listGeneral({ category: 'Office Stationery' }, testToken);
    TestHarness.assert(listRes.totals.totalAmount >= 500, true, 'Total amount must include newly created expense');
    TestHarness.assert(listRes.totals.categoryBreakdown['Office Stationery'] >= 500, true, 'Category breakdown must include 500');

    // Cleanup
    ExpensesModule.deleteGeneral(created.id, testToken);
  });

  // 3. Auto-Sync Rule D8: Create Enquiry with Diesel ₹3,000 -> Auto creates exactly 1 loading expense
  let testEnquiryId = null;
  TestHarness.test('Expenses: Enquiry create with Diesel auto-syncs to loading_expenses', () => {
    const uniqueNum = Math.floor(1000 + Math.random() * 9000);
    const res = EnquiryModule.create(
      {
        companyId: testCompanyId,
        clientId: testClientId,
        loadingType: 'Export',
        vehicleNumber: 'TN09EX' + uniqueNum,
        driverName: 'Expense Driver',
        driverPhone: '97777' + Math.floor(10000 + Math.random() * 90000),
        containerNumber: 'EXPU' + Math.floor(1000000 + Math.random() * 9000000),
        freightAmount: 25000,
        dieselAmount: 3000,
        haltingAmount: 1500,
        haltingDays: 1,
      },
      testToken
    );

    testEnquiryId = res.enquiry.id;
    TestHarness.assert(typeof testEnquiryId === 'string', true, 'Enquiry created successfully');

    // Verify auto-synced loading expenses
    const list = ExpensesModule.listLoading({ enquiryId: testEnquiryId }, testToken);
    TestHarness.assert(list.items.length, 2, 'Should have exactly 2 auto-synced rows (Diesel and Halting)');

    const dieselRow = list.items.find((i) => i.category === 'Diesel');
    TestHarness.assert(Boolean(dieselRow), true, 'Diesel row must exist');
    TestHarness.assert(dieselRow.amount, 3000, 'Diesel amount must be 3000');
    TestHarness.assert(dieselRow.source, 'ENQUIRY', 'Source must be ENQUIRY');

    const haltingRow = list.items.find((i) => i.category === 'Halting');
    TestHarness.assert(Boolean(haltingRow), true, 'Halting row must exist');
    TestHarness.assert(haltingRow.amount, 1500, 'Halting amount must be 1500');
    TestHarness.assert(haltingRow.source, 'ENQUIRY', 'Source must be ENQUIRY');
  });

  // 4. Auto-Sync Rule D8: Rejection of manual edit/delete on ENQUIRY source
  TestHarness.test('Expenses: Direct edit or delete of ENQUIRY-sourced expense is rejected', () => {
    const list = ExpensesModule.listLoading({ enquiryId: testEnquiryId }, testToken);
    const dieselRow = list.items.find((i) => i.category === 'Diesel');
    TestHarness.assert(Boolean(dieselRow), true, 'Diesel row exists');

    // Attempt update
    let updateBlocked = false;
    try {
      ExpensesModule.updateLoading(dieselRow.id, { amount: 4000 }, testToken);
    } catch (e) {
      if (e.message.includes('Edit this from the enquiry')) {
        updateBlocked = true;
      }
    }
    TestHarness.assert(updateBlocked, true, 'Direct update must throw "Edit this from the enquiry"');

    // Attempt delete
    let deleteBlocked = false;
    try {
      ExpensesModule.deleteLoading(dieselRow.id, testToken);
    } catch (e) {
      if (e.message.includes('Edit this from the enquiry')) {
        deleteBlocked = true;
      }
    }
    TestHarness.assert(deleteBlocked, true, 'Direct delete must throw "Edit this from the enquiry"');
  });

  // 5. Auto-Sync Rule D8: Update Diesel to ₹3,500 updates row without duplicates
  TestHarness.test('Expenses: Updating enquiry diesel amount updates existing row without duplicate', () => {
    EnquiryModule.update(testEnquiryId, { dieselAmount: 3500 }, testToken);

    const list = ExpensesModule.listLoading({ enquiryId: testEnquiryId }, testToken);
    const dieselRows = list.items.filter((i) => i.category === 'Diesel');
    TestHarness.assert(dieselRows.length, 1, 'Must have exactly 1 Diesel row (no duplicates)');
    TestHarness.assert(dieselRows[0].amount, 3500, 'Diesel amount must be updated to 3500');
  });

  // 6. Auto-Sync Rule D8: Setting Halting to 0 removes the halting row
  TestHarness.test('Expenses: Setting halting amount to 0 removes the auto-synced halting row', () => {
    EnquiryModule.update(testEnquiryId, { haltingAmount: 0 }, testToken);

    const list = ExpensesModule.listLoading({ enquiryId: testEnquiryId }, testToken);
    const haltingRow = list.items.find((i) => i.category === 'Halting');
    TestHarness.assert(Boolean(haltingRow), false, 'Halting row should be removed when amount is 0');
  });

  // 7. Auto-Sync Rule D8: Soft delete enquiry cleans up linked auto-synced expenses
  TestHarness.test('Expenses: Soft deleting enquiry removes all linked auto-synced expenses', () => {
    EnquiryModule.delete(testEnquiryId, testToken);

    const list = ExpensesModule.listLoading({ enquiryId: testEnquiryId }, testToken);
    TestHarness.assert(list.items.length, 0, 'No active loading expenses should remain for deleted enquiry');
  });
}
