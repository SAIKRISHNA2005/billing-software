/**
 * Comprehensive System Test Suite
 * Tests Endpoints, Real Data Integrity, UI Pages, Edge Cases, and Generates Structured Results
 */

const BASE_URL = 'http://localhost:3000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTestSuite() {
  const results = {
    startTime: new Date().toISOString(),
    auth: [],
    masterEndpoints: [],
    dashboardEndpoints: [],
    enquiriesEndpoints: [],
    operationsEndpoints: [],
    billingEndpoints: [],
    expensesEndpoints: [],
    vendorEndpoints: [],
    reportsEndpoints: [],
    exportsEndpoints: [],
    settingsEndpoints: [],
    realDataIntegrity: [],
    edgeCases: [],
    uiPages: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };

  function record(category, testName, passed, details = {}) {
    results.summary.total++;
    if (passed) results.summary.passed++;
    else results.summary.failed++;

    results[category].push({
      testName,
      status: passed ? 'PASS' : 'FAIL',
      ...details
    });
  }

  console.log('=== STARTING COMPREHENSIVE END-TO-END TEST SUITE ===\n');

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION TESTING
  // -------------------------------------------------------------
  console.log('--- 1. Testing Auth Endpoints ---');
  let authCookie = '';

  // 1a. Login with valid credentials (with retry)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@tms.local', password: 'Admin@12345' })
      });
      const t = Date.now() - t0;
      const json = await res.json();
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      const sessionCookie = (setCookies || []).find((c) => c && c.startsWith('tms_session='));
      authCookie = sessionCookie ? sessionCookie.split(';')[0] : '';

      if (res.status === 200 && json.success === true && Boolean(authCookie)) {
        record('auth', 'Valid Login (admin@tms.local)', true, {
          statusCode: res.status,
          latencyMs: t,
          userRole: json.data?.user?.role || 'admin',
          hasCookie: true,
          attempts: attempt
        });
        break;
      } else if (attempt === 3) {
        record('auth', 'Valid Login (admin@tms.local)', false, {
          statusCode: res.status,
          message: json.message,
          hasCookie: Boolean(authCookie)
        });
      } else {
        await sleep(1500);
      }
    } catch (err) {
      if (attempt === 3) {
        record('auth', 'Valid Login (admin@tms.local)', false, { error: err.message });
      }
      await sleep(1500);
    }
  }

  // 1b. Verify /api/auth/me with session
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const pass = res.status === 200 && json.success === true && (json.data?.user?.email === 'admin@tms.local' || json.data?.email === 'admin@tms.local');
    record('auth', 'Session Verification (/api/auth/me)', pass, {
      statusCode: res.status,
      latencyMs: t,
      email: json.data?.user?.email || json.data?.email,
      name: json.data?.user?.name || json.data?.name
    });
  } catch (err) {
    record('auth', 'Session Verification (/api/auth/me)', false, { error: err.message });
  }

  // 1c. Invalid login credentials rejection
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@tms.local', password: 'WrongPassword999!' })
    });
    const json = await res.json();
    const pass = res.status === 401 && json.success === false;
    record('auth', 'Invalid Credentials Rejection', pass, {
      statusCode: res.status,
      message: json.message
    });
  } catch (err) {
    record('auth', 'Invalid Credentials Rejection', false, { error: err.message });
  }

  // 1d. Unauthenticated access rejection
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const json = await res.json();
    const pass = res.status === 401 && json.success === false;
    record('auth', 'Unauthenticated Rejection (/api/auth/me)', pass, {
      statusCode: res.status,
      message: json.message
    });
  } catch (err) {
    record('auth', 'Unauthenticated Rejection (/api/auth/me)', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 2. MASTER ENTITIES ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 2. Testing Master Data Endpoints ---');
  const masterEntities = ['companies', 'clients', 'vendors', 'vehicles', 'drivers', 'containers'];
  const masterDataStore = {};

  for (const entity of masterEntities) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/master/${entity}?limit=50`, {
        headers: { Cookie: authCookie }
      });
      const t = Date.now() - t0;
      const json = await res.json();
      const items = json.data?.items || json.data || [];
      masterDataStore[entity] = items;
      const pass = res.status === 200 && json.success === true && Array.isArray(items) && items.length > 0;
      record('masterEndpoints', `Master Entity: ${entity}`, pass, {
        statusCode: res.status,
        latencyMs: t,
        count: items.length,
        sampleId: items[0]?.id || 'N/A',
        sampleIdentifier: items[0]?.name || items[0]?.vehicleNumber || items[0]?.containerNumber || 'N/A'
      });
    } catch (err) {
      record('masterEndpoints', `Master Entity: ${entity}`, false, { error: err.message });
    }
  }

  // -------------------------------------------------------------
  // 3. DASHBOARD SUMMARY & STATS
  // -------------------------------------------------------------
  console.log('--- 3. Testing Dashboard Endpoints ---');
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const d = json.data;
    const pass = res.status === 200 && json.success === true && typeof d === 'object';
    record('dashboardEndpoints', 'Dashboard Summary KPI Endpoint', pass, {
      statusCode: res.status,
      latencyMs: t,
      revenue: d?.totalRevenue ?? d?.revenue ?? 'N/A',
      activeMovements: d?.activeMovements ?? d?.movementsCount ?? 'N/A',
      pendingBills: d?.pendingBills ?? d?.pendingCount ?? 'N/A'
    });
  } catch (err) {
    record('dashboardEndpoints', 'Dashboard Summary KPI Endpoint', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 4. ENQUIRIES ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 4. Testing Enquiries Endpoints ---');
  let sampleEnquiryId = 'ENQ-10008';

  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/enquiries?limit=50`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const items = json.data?.items || json.data || [];
    if (items.length > 0 && items[0]?.id) sampleEnquiryId = items[0].id;
    const pass = res.status === 200 && json.success === true && Array.isArray(items) && items.length > 0;
    record('enquiriesEndpoints', 'Enquiry List (/api/enquiries)', pass, {
      statusCode: res.status,
      latencyMs: t,
      count: items.length,
      sampleId: sampleEnquiryId,
      sampleStage: items[0]?.stage,
      sampleCustomer: items[0]?.clientName || items[0]?.clientId
    });
  } catch (err) {
    record('enquiriesEndpoints', 'Enquiry List (/api/enquiries)', false, { error: err.message });
  }

  // 4b. Single enquiry details
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/enquiries/${sampleEnquiryId}`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const item = json.data?.enquiry || json.data;
    const pass = res.status === 200 && json.success === true && Boolean(item && (item.id === sampleEnquiryId || item.enquiryNumber));
    
    record('enquiriesEndpoints', `Enquiry Detail (${sampleEnquiryId})`, pass, {
      statusCode: res.status,
      latencyMs: t,
      enquiryNumber: item?.enquiryNumber,
      stage: item?.stage,
      vehicle: item?.vehicleId || item?.vehicleNo || item?.vehicleNumber,
      container: item?.containerId || item?.containerNo || item?.containerNumber,
      freightAmount: item?.freightAmount
    });
  } catch (err) {
    record('enquiriesEndpoints', `Enquiry Detail (${sampleEnquiryId})`, false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 5. OPERATIONS ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 5. Testing Operations Endpoints ---');
  const opEndpoints = [
    { name: 'Operations Movements', path: '/api/operations/movements' },
    { name: 'Operations Pending', path: '/api/operations/pending' },
    { name: 'Operations Completed', path: '/api/operations/completed' }
  ];

  for (const op of opEndpoints) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}${op.path}`, {
        headers: { Cookie: authCookie }
      });
      const t = Date.now() - t0;
      const json = await res.json();
      const items = json.data?.items || json.data || [];
      const pass = res.status === 200 && json.success === true;
      record('operationsEndpoints', op.name, pass, {
        statusCode: res.status,
        latencyMs: t,
        count: Array.isArray(items) ? items.length : 'N/A'
      });
    } catch (err) {
      record('operationsEndpoints', op.name, false, { error: err.message });
    }
  }

  // -------------------------------------------------------------
  // 6. BILLING ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 6. Testing Billing Endpoints ---');
  let sampleBillId = 'BIL-10002';

  // 6a. Bills list
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/billing/bills?limit=20`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const items = json.data?.items || json.data || [];
    if (items.length > 0 && items[0]?.id) sampleBillId = items[0].id;
    const pass = res.status === 200 && json.success === true && Array.isArray(items) && items.length > 0;
    record('billingEndpoints', 'Bills List (/api/billing/bills)', pass, {
      statusCode: res.status,
      latencyMs: t,
      count: items.length,
      sampleId: sampleBillId,
      sampleTotal: items[0]?.totalAmount
    });
  } catch (err) {
    record('billingEndpoints', 'Bills List (/api/billing/bills)', false, { error: err.message });
  }

  // 6b. Bill detail
  let fullBillData = null;
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/billing/bills/${sampleBillId}`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    fullBillData = json.data;
    const pass = res.status === 200 && json.success === true && fullBillData?.id === sampleBillId;
    record('billingEndpoints', `Bill Detail (${sampleBillId})`, pass, {
      statusCode: res.status,
      latencyMs: t,
      billNumber: fullBillData?.billNumber,
      clientName: fullBillData?.clientName,
      totalAmount: fullBillData?.totalAmount,
      itemsCount: fullBillData?.items?.length,
      enquiriesCount: fullBillData?.enquiries?.length
    });
  } catch (err) {
    record('billingEndpoints', `Bill Detail (${sampleBillId})`, false, { error: err.message });
  }

  // 6c. HTML Invoice Preview Endpoint (/api/billing/preview?format=html)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/billing/preview?id=${sampleBillId}&format=html`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const html = await res.text();
    const hasHeader = html.includes('SRI PONNIAMMAN TRANS') || html.includes('header.png');
    const hasTable = html.includes('charges-table');
    const hasSealAndSignature = html.includes('seal-and-signature.png') || html.includes('Seal &amp; Signature') || html.includes('Seal & Signature');
    const hasNoEmptyRows = !html.includes('<td>&nbsp;</td>');
    const hasFreightFormula = html.includes(' X ');

    const pass = res.status === 200 && hasTable && hasSealAndSignature && hasFreightFormula;
    record('billingEndpoints', `HTML Invoice Preview (${sampleBillId})`, pass, {
      statusCode: res.status,
      latencyMs: t,
      htmlLength: html.length,
      hasHeader,
      hasTable,
      hasSealAndSignature,
      hasNoEmptyRows,
      hasFreightFormula
    });
  } catch (err) {
    record('billingEndpoints', 'HTML Invoice Preview', false, { error: err.message });
  }

  // 6d. PDF Binary Stream Endpoint (/api/billing/pdf/[id]?format=pdf)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/billing/pdf/${sampleBillId}?format=pdf`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const buf = await res.arrayBuffer();
    const magicHeader = Buffer.from(buf.slice(0, 5)).toString();
    const pass = res.status === 200 && magicHeader === '%PDF-' && buf.byteLength > 1000;
    record('billingEndpoints', `PDF Binary Stream Generation (${sampleBillId})`, pass, {
      statusCode: res.status,
      latencyMs: t,
      pdfHeader: magicHeader,
      sizeBytes: buf.byteLength
    });
  } catch (err) {
    record('billingEndpoints', 'PDF Binary Stream Generation', false, { error: err.message });
  }

  // 6e. PDF Base64 JSON Payload (/api/billing/pdf/[id])
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/billing/pdf/${sampleBillId}`, {
      headers: { Cookie: authCookie }
    });
    const t = Date.now() - t0;
    const json = await res.json();
    const pass = res.status === 200 && json.success === true && Boolean(json.data?.pdfBase64);
    record('billingEndpoints', `PDF Base64 JSON Payload (${sampleBillId})`, pass, {
      statusCode: res.status,
      latencyMs: t,
      base64Length: json.data?.pdfBase64 ? json.data.pdfBase64.length : 0,
      amountInWords: json.data?.amountInWords
    });
  } catch (err) {
    record('billingEndpoints', 'PDF Base64 JSON Payload', false, { error: err.message });
  }

  // 6e. Ageing & Payments Endpoints
  try {
    const res = await fetch(`${BASE_URL}/api/billing/ageing`, { headers: { Cookie: authCookie } });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('billingEndpoints', 'Billing Ageing Endpoint (/api/billing/ageing)', pass, {
      statusCode: res.status,
      summary: json.data?.summary || 'OK'
    });
  } catch (err) {
    record('billingEndpoints', 'Billing Ageing Endpoint', false, { error: err.message });
  }

  try {
    const res = await fetch(`${BASE_URL}/api/billing/payments`, { headers: { Cookie: authCookie } });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('billingEndpoints', 'Billing Payments Endpoint (/api/billing/payments)', pass, {
      statusCode: res.status,
      count: json.data?.items?.length ?? json.data?.length ?? 0
    });
  } catch (err) {
    record('billingEndpoints', 'Billing Payments Endpoint', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 7. EXPENSES ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 7. Testing Expenses Endpoints ---');
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/expenses/loading`, { headers: { Cookie: authCookie } });
    const t = Date.now() - t0;
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('expensesEndpoints', 'Loading Expenses (/api/expenses/loading)', pass, {
      statusCode: res.status,
      latencyMs: t,
      itemsCount: json.data?.items?.length ?? json.data?.length ?? 0
    });
  } catch (err) {
    record('expensesEndpoints', 'Loading Expenses', false, { error: err.message });
  }

  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/expenses/general`, { headers: { Cookie: authCookie } });
    const t = Date.now() - t0;
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('expensesEndpoints', 'General Expenses (/api/expenses/general)', pass, {
      statusCode: res.status,
      latencyMs: t,
      itemsCount: json.data?.items?.length ?? json.data?.length ?? 0
    });
  } catch (err) {
    record('expensesEndpoints', 'General Expenses', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 8. VENDOR ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 8. Testing Vendor Endpoints ---');
  try {
    const res = await fetch(`${BASE_URL}/api/vendors/report`, { headers: { Cookie: authCookie } });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('vendorEndpoints', 'Vendor Report (/api/vendors/report)', pass, {
      statusCode: res.status
    });
  } catch (err) {
    record('vendorEndpoints', 'Vendor Report', false, { error: err.message });
  }

  try {
    const res = await fetch(`${BASE_URL}/api/vendors/payments`, { headers: { Cookie: authCookie } });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('vendorEndpoints', 'Vendor Payments (/api/vendors/payments)', pass, {
      statusCode: res.status
    });
  } catch (err) {
    record('vendorEndpoints', 'Vendor Payments', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 9. REPORTS ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 9. Testing Reports Endpoints ---');
  const reportList = [
    { name: 'Daily Report', path: '/api/reports/daily' },
    { name: 'Company Report', path: '/api/reports/company' },
    { name: 'Billing Report', path: '/api/reports/billing' }
  ];

  for (const rep of reportList) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}${rep.path}`, { headers: { Cookie: authCookie } });
      const t = Date.now() - t0;
      const json = await res.json();
      const pass = res.status === 200 && json.success === true;
      record('reportsEndpoints', `${rep.name} (${rep.path})`, pass, {
        statusCode: res.status,
        latencyMs: t
      });
    } catch (err) {
      record('reportsEndpoints', `${rep.name} (${rep.path})`, false, { error: err.message });
    }
  }

  // -------------------------------------------------------------
  // 10. EXPORTS & SETTINGS ENDPOINTS
  // -------------------------------------------------------------
  console.log('--- 10. Testing Exports & Settings Endpoints ---');
  try {
    const res = await fetch(`${BASE_URL}/api/exports/master-excel?entity=vehicles`, { headers: { Cookie: authCookie } });
    const pass = res.status === 200;
    record('exportsEndpoints', 'Master Excel Export (/api/exports/master-excel)', pass, {
      statusCode: res.status,
      contentType: res.headers.get('content-type')
    });
  } catch (err) {
    record('exportsEndpoints', 'Master Excel Export', false, { error: err.message });
  }

  try {
    const res = await fetch(`${BASE_URL}/api/settings/audit`, { headers: { Cookie: authCookie } });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('settingsEndpoints', 'Audit Logs (/api/settings/audit)', pass, {
      statusCode: res.status,
      logsCount: json.data?.items?.length ?? json.data?.length ?? 0
    });
  } catch (err) {
    record('settingsEndpoints', 'Audit Logs', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 11. REAL DATA INTEGRITY & FIELD COVERAGE AUDIT
  // -------------------------------------------------------------
  console.log('--- 11. Deep Real Data Integrity & Field Coverage ---');
  // Check Bill BIL-10002 fields
  if (fullBillData) {
    const billFields = [
      'id', 'billNumber', 'billingDate', 'companyId', 'companyName',
      'clientId', 'clientName', 'totalAmount', 'items', 'enquiries'
    ];
    const missingBillFields = billFields.filter((f) => fullBillData[f] === undefined || fullBillData[f] === null);
    const hasItemsData = Array.isArray(fullBillData.items) && fullBillData.items.length > 0;
    const sampleItem = hasItemsData ? fullBillData.items[0] : null;
    const itemFieldsValid = Boolean(sampleItem?.description && sampleItem?.amount !== undefined);

    record('realDataIntegrity', `Bill Real Data Fields: BIL-10002`, missingBillFields.length === 0 && hasItemsData && itemFieldsValid, {
      totalFieldsChecked: billFields.length,
      missingFields: missingBillFields,
      billNumber: fullBillData.billNumber,
      clientName: fullBillData.clientName,
      companyName: fullBillData.companyName,
      totalAmount: fullBillData.totalAmount,
      itemFieldsValid
    });
  }

  // Check Master Data Entities coverage
  for (const entity of Object.keys(masterDataStore)) {
    const items = masterDataStore[entity];
    const sample = items && items[0];
    const pass = Boolean(sample && sample.id);
    record('realDataIntegrity', `Master Data Fields: ${entity}`, pass, {
      count: items ? items.length : 0,
      sampleId: sample?.id,
      sampleKeysCount: sample ? Object.keys(sample).length : 0
    });
  }

  // -------------------------------------------------------------
  // 12. BOUNDARY & EDGE CASES
  // -------------------------------------------------------------
  console.log('--- 12. Testing Boundary & Edge Cases ---');

  // 12a. Request non-existent bill ID
  try {
    const res = await fetch(`${BASE_URL}/api/billing/bills/NON-EXISTENT-XYZ-999`, {
      headers: { Cookie: authCookie }
    });
    const json = await res.json();
    const pass = res.status === 404 || json.success === false;
    record('edgeCases', 'Non-existent Bill ID Handling', pass, {
      statusCode: res.status,
      message: json.message
    });
  } catch (err) {
    record('edgeCases', 'Non-existent Bill ID Handling', false, { error: err.message });
  }

  // 12b. PDF generation for invalid bill ID
  try {
    const res = await fetch(`${BASE_URL}/api/billing/pdf/INVALID-BILL-0000`, {
      headers: { Cookie: authCookie }
    });
    const pass = res.status >= 400;
    record('edgeCases', 'Invalid Bill PDF Request', pass, {
      statusCode: res.status
    });
  } catch (err) {
    record('edgeCases', 'Invalid Bill PDF Request', false, { error: err.message });
  }

  // 12c. Search with special characters
  try {
    const res = await fetch(`${BASE_URL}/api/enquiries?search=${encodeURIComponent('!@#$%^&*()_+')}`, {
      headers: { Cookie: authCookie }
    });
    const json = await res.json();
    const pass = res.status === 200 && json.success === true;
    record('edgeCases', 'Special Characters Search Handling', pass, {
      statusCode: res.status,
      resultCount: json.data?.items?.length ?? json.data?.length ?? 0
    });
  } catch (err) {
    record('edgeCases', 'Special Characters Search Handling', false, { error: err.message });
  }

  // 12d. Master entities with pagination limits (limit=1)
  try {
    const res = await fetch(`${BASE_URL}/api/master/vehicles?limit=1&page=1`, {
      headers: { Cookie: authCookie }
    });
    const json = await res.json();
    const items = json.data?.items || json.data || [];
    const pass = res.status === 200 && items.length <= 1;
    record('edgeCases', 'Pagination Boundary (limit=1)', pass, {
      statusCode: res.status,
      returnedCount: items.length
    });
  } catch (err) {
    record('edgeCases', 'Pagination Boundary (limit=1)', false, { error: err.message });
  }

  // 12e. Bad payload on enquiry create (empty JSON)
  try {
    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({})
    });
    const pass = res.status === 400 || res.status === 422;
    record('edgeCases', 'Empty Payload Validation Reject (POST /api/enquiries)', pass, {
      statusCode: res.status
    });
  } catch (err) {
    record('edgeCases', 'Empty Payload Validation Reject', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // 13. WEB UI PAGES RENDERING AUDIT (SSR & Client Shells)
  // -------------------------------------------------------------
  console.log('--- 13. Testing Web UI Pages (SSR & Page Routes) ---');
  const uiRoutes = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Enquiries List', path: '/enquiries' },
    { name: 'Enquiry Create', path: '/enquiries/new' },
    { name: 'Operations: Movement', path: '/operations/movement' },
    { name: 'Operations: Pending', path: '/operations/pending' },
    { name: 'Operations: Completed', path: '/operations/completed' },
    { name: 'Billing: Processed List', path: '/billing/processed' },
    { name: 'Billing: Invoice Preview Page', path: '/billing/preview' },
    { name: 'Billing: Ageing Report', path: '/billing/ageing' },
    { name: 'Billing: Payments', path: '/billing/payments' },
    { name: 'Expenses: Loading', path: '/expenses/loading' },
    { name: 'Expenses: General', path: '/expenses/general' },
    { name: 'Reports: Daily', path: '/reports/daily' },
    { name: 'Reports: Company', path: '/reports/company' },
    { name: 'Reports: Vendor', path: '/reports/vendor' },
    { name: 'Reports: Billing', path: '/reports/billing' },
    { name: 'Settings: Profile', path: '/settings/profile' },
    { name: 'Settings: Audit', path: '/settings/audit' },
    { name: 'Exports: Excel', path: '/exports/excel' },
    { name: 'Exports: PDF', path: '/exports/pdf' }
  ];

  for (const route of uiRoutes) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}${route.path}`, {
        headers: { Cookie: authCookie }
      });
      const t = Date.now() - t0;
      const html = await res.text();
      const isHtml = res.headers.get('content-type')?.includes('text/html');
      const pass = res.status === 200 && isHtml && !html.includes('Application error') && html.length > 500;
      record('uiPages', `UI Route: ${route.name} (${route.path})`, pass, {
        statusCode: res.status,
        latencyMs: t,
        contentLength: html.length,
        isHtml
      });
    } catch (err) {
      record('uiPages', `UI Route: ${route.name}`, false, { error: err.message });
    }
  }

  results.endTime = new Date().toISOString();
  console.log('\n=== TEST SUITE COMPLETED ===');
  console.log(`Total Tests: ${results.summary.total} | Passed: ${results.summary.passed} | Failed: ${results.summary.failed}`);

  return results;
}

runTestSuite().then((res) => {
  console.log('FINAL_OUTPUT_START');
  console.log(JSON.stringify(res, null, 2));
  console.log('FINAL_OUTPUT_END');
}).catch(console.error);
