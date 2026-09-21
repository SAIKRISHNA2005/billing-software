/**
 * Transport & Logistics Management System (TMS)
 * Phase 10 - Vendor Test Suite (Tests_Vendor.js)
 */

function testVendorSuite() {
  Logger.log('--- Testing Vendor Payments, Settlements & Report (Phase 10) ---');

  // Ensure test operator session exists
  const scriptProps = PropertiesService.getScriptProperties();
  const testPassword = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';
  const loginRes = AuthModule.login({ email: 'admin@tms.local', password: testPassword });
  const testToken = loginRes.token;

  // Resolve test company, client, and vendor
  const companies = SheetRepo.getAllRows('companies', false);
  const clients = SheetRepo.getAllRows('clients', false);
  const testCompanyId = companies.length > 0 ? companies[0].id : 'CMP-001';
  const testClientId = clients.length > 0 ? clients[0].id : 'CLI-201';

  // Create a dedicated test vendor to ensure predictable math
  const vendorName = 'SPT TRANSPORTS TEST ' + Math.floor(1000 + Math.random() * 9000);
  const vendorRes = MasterDataModule.create(
    'vendors',
    {
      name: vendorName,
      contactPerson: 'Suresh Kumar',
      phone: '9876543210',
      email: 'spt@transports.test',
      pan: 'ABCDE1234F',
    },
    testToken
  );
  const testVendorId = vendorRes.id;

  // 1. Test Vendor Payment CRUD
  let testPaymentId = null;
  TestHarness.test('Vendor: Payment create, get, update, delete', () => {
    const created = VendorModule.createPayment(
      {
        vendorId: testVendorId,
        paymentDate: '21-09-2026',
        amount: 5000,
        mode: 'Bank Transfer',
        reference: 'UTR1234567890',
        notes: 'Initial advance settlement',
      },
      testToken
    );

    TestHarness.assert(typeof created.payment.id === 'string' && created.payment.id.startsWith('VPAY-'), true, 'Payment ID has VPAY- prefix');
    TestHarness.assert(created.payment.amount, 5000, 'Payment amount should be 5000');
    testPaymentId = created.payment.id;

    // Get
    const fetched = VendorModule.getPayment(testPaymentId, testToken);
    TestHarness.assert(fetched.reference, 'UTR1234567890', 'Reference should match');

    // Update
    const updated = VendorModule.updatePayment(testPaymentId, { amount: 6000, reference: 'UTR99999' }, testToken);
    TestHarness.assert(updated.amount, 6000, 'Updated amount should be 6000');
    TestHarness.assert(updated.reference, 'UTR99999', 'Updated reference should match');

    // Delete
    const delRes = VendorModule.deletePayment(testPaymentId, testToken);
    TestHarness.assert(delRes.deleted, true, 'Payment should be soft-deleted');
  });

  // 2. Test Check Before Commit: Vendor SPT with trips totalling ₹1,45,000 and payments ₹1,20,000 shows Pending ₹25,000
  TestHarness.test('Vendor: Check Before Commit - Trips ₹1,45,000 and payments ₹1,20,000 shows Pending ₹25,000', () => {
    // Create Trip 1: Advance 40,000 + Extra Advance 10,000 + Diesel 25,000 + Halting 5,000 = Total Payable 80,000
    const trip1 = EnquiryModule.create(
      {
        companyId: testCompanyId,
        clientId: testClientId,
        vendorId: testVendorId,
        loadingType: 'Import',
        vehicleNumber: 'TN09SP' + Math.floor(1000 + Math.random() * 9000),
        driverName: 'SPT Driver 1',
        driverPhone: '98888' + Math.floor(10000 + Math.random() * 90000),
        containerNumber: 'SPTU' + Math.floor(1000000 + Math.random() * 9000000),
        freightAmount: 90000,
        advanceAmount: 40000,
        extraAdvance: 10000,
        dieselAmount: 25000,
        haltingAmount: 5000,
      },
      testToken
    );

    // Create Trip 2: Advance 35,000 + Extra Advance 5,000 + Diesel 20,000 + Halting 3,000 + Bonus 2,000 = Total Payable 65,000
    // Total Trips Payable = 80,000 + 65,000 = 1,45,000
    const trip2 = EnquiryModule.create(
      {
        companyId: testCompanyId,
        clientId: testClientId,
        vendorId: testVendorId,
        loadingType: 'Export',
        vehicleNumber: 'TN09SP' + Math.floor(1000 + Math.random() * 9000),
        driverName: 'SPT Driver 2',
        driverPhone: '98888' + Math.floor(10000 + Math.random() * 90000),
        containerNumber: 'SPTU' + Math.floor(1000000 + Math.random() * 9000000),
        freightAmount: 75000,
        advanceAmount: 35000,
        extraAdvance: 5000,
        dieselAmount: 20000,
        haltingAmount: 3000,
        bonus: 2000,
      },
      testToken
    );

    // Record Payment 1 (allocated to Trip 1): ₹70,000
    VendorModule.createPayment(
      {
        vendorId: testVendorId,
        enquiryId: trip1.enquiry.id,
        paymentDate: '21-09-2026',
        amount: 70000,
        mode: 'Bank Transfer',
        reference: 'UTR-TRIP1',
      },
      testToken
    );

    // Record Payment 2 (allocated to Trip 2): ₹30,000
    VendorModule.createPayment(
      {
        vendorId: testVendorId,
        enquiryId: trip2.enquiry.id,
        paymentDate: '21-09-2026',
        amount: 30000,
        mode: 'UPI',
        reference: 'UPI-TRIP2',
      },
      testToken
    );

    // Record Payment 3 (Unallocated / General vendor advance): ₹20,000
    // Total Payments = 70,000 + 30,000 + 20,000 = 1,20,000
    VendorModule.createPayment(
      {
        vendorId: testVendorId,
        paymentDate: '21-09-2026',
        amount: 20000,
        mode: 'Bank Transfer',
        reference: 'UTR-UNALLOC',
      },
      testToken
    );

    // Fetch vendor trips ledger
    const ledger = VendorModule.getVendorTrips(testVendorId, testToken);

    TestHarness.assert(ledger.summary.totalPayable, 145000, 'Total payable must be ₹1,45,000');
    TestHarness.assert(ledger.summary.allocatedPaid, 100000, 'Allocated paid must be ₹1,00,000');
    TestHarness.assert(ledger.summary.unallocatedPaid, 20000, 'Unallocated paid must be ₹20,000');
    TestHarness.assert(ledger.summary.totalPaid, 120000, 'Total paid must be ₹1,20,000');
    TestHarness.assert(ledger.summary.netBalance, 25000, 'Net pending balance must be exactly ₹25,000');
  });

  // 3. Test Overpayment Warning Flag (warn, do not block)
  TestHarness.test('Vendor: Overpayment generates warning flag but does not block', () => {
    // Current pending balance is ₹25,000. Paying ₹30,000 should succeed with warning flag
    const res = VendorModule.createPayment(
      {
        vendorId: testVendorId,
        paymentDate: '21-09-2026',
        amount: 30000,
        mode: 'Cash',
        notes: 'Excess cash payment test',
      },
      testToken
    );

    TestHarness.assert(Boolean(res.payment && res.payment.id), true, 'Payment must be recorded');
    TestHarness.assert(res.warning, true, 'Warning flag must be true on overpayment');
    TestHarness.assert(typeof res.warningMessage === 'string' && res.warningMessage.includes('exceeds'), true, 'Warning message must explain overpayment');

    // Clean up test excess payment
    VendorModule.deletePayment(res.payment.id, testToken);
  });

  // 4. Test Vendor Report single batched pass & totals match rows
  TestHarness.test('Vendor: Report totals equal the sum of rows', () => {
    const report = VendorModule.getVendorReport({ vendorId: testVendorId }, testToken);

    TestHarness.assert(report.rows.length, 1, 'Should return exactly 1 row for test vendor');
    const row = report.rows[0];

    TestHarness.assert(row.totalAmount, 145000, 'Report total amount must be 145000');
    TestHarness.assert(row.paid, 120000, 'Report paid must be 120000');
    TestHarness.assert(row.pending, 25000, 'Report pending must be 25000');

    // Run global report and verify grand total matches sum of rows
    const fullReport = VendorModule.getVendorReport({}, testToken);
    let sumTotalAmount = 0;
    let sumPaid = 0;
    let sumPending = 0;

    fullReport.rows.forEach((r) => {
      sumTotalAmount += r.totalAmount;
      sumPaid += r.paid;
      sumPending += r.pending;
    });

    TestHarness.assert(Math.round(fullReport.grandTotal.totalAmount), Math.round(sumTotalAmount), 'Grand total amount must equal sum of rows');
    TestHarness.assert(Math.round(fullReport.grandTotal.paid), Math.round(sumPaid), 'Grand total paid must equal sum of rows');
    TestHarness.assert(Math.round(fullReport.grandTotal.pending), Math.round(sumPending), 'Grand total pending must equal sum of rows');
  });
}
