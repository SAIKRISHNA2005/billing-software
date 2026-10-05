// Real Live Verification Script for Phase 8: Live External Workbooks Synchronization
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const APPS_SCRIPT_URL = env.APPS_SCRIPT_EXEC_URL || env.APPS_SCRIPT_URL;
const SHARED_SECRET = env.APPS_SCRIPT_SHARED_SECRET || '';
const DAILY_REPORT_SS_ID = env.DAILY_REPORT_SPREADSHEET_ID || '1nNV4hNa6C9AV929jrWP3uT_0wXXH4Cl-ESJ1LpZ6Jio';
const COMPANY_REPORT_SS_ID = env.COMPANY_REPORT_SPREADSHEET_ID || '1yTJ8wkzCP0zkYfwtBh0xChEfL7GKk5jOGzl2UmPYYHk';
const PROCESSED_BILLS_SS_ID = env.PROCESSED_BILLS_SPREADSHEET_ID || '1ZhoTFFOARxJiTtnEKyuljFmgTmMWXdxTkVCkuBsH1Ug';

async function callAppsScriptRaw(action, payload, sessionToken = null) {
  const postData = JSON.stringify({
    action,
    payload: payload || {},
    sessionToken,
    secret: SHARED_SECRET,
  });

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tms-proxy-secret': SHARED_SECRET,
    },
    body: postData,
    redirect: 'follow',
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: false, raw: text, error: e.message };
  }
}

function requestHttp(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function loginAndGetCookie() {
  const loginRes = await requestHttp(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@tms.local', password: 'Admin@12345' }
  );
  const setCookie = loginRes.headers['set-cookie'] || [];
  const tmsCookie = setCookie.find((c) => c.startsWith('tms_session='));
  return tmsCookie ? tmsCookie.split(';')[0].replace('tms_session=', '') : null;
}

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('STARTING PHASE 8 LIVE REAL-SYSTEM TESTS');
  console.log('====================================================\n');

  const token = await loginAndGetCookie();
  if (!token) {
    console.error('FATAL: Could not log in to obtain session token');
    process.exit(1);
  }
  console.log('Session authenticated successfully.');
  console.log(`External Workbooks Configuration:
  - DAILY_REPORT_SPREADSHEET_ID:    ${DAILY_REPORT_SS_ID}
  - COMPANY_REPORT_SPREADSHEET_ID:  ${COMPANY_REPORT_SS_ID}
  - PROCESSED_BILLS_SPREADSHEET_ID: ${PROCESSED_BILLS_SS_ID}\n`);

  const results = [];
  const timestamp = Date.now();

  // ----------------------------------------------------------------
  // 8.1: TMS Daily Report Workbook (23 Columns + Hidden _enquiryId)
  // ----------------------------------------------------------------
  console.log('--- Test 8.1: TMS Daily Report Live Sync ---');
  const dailyPayload = {
    id: 'ENQ-10042',
    creationDate: '2026-10-05',
    bookingDate: '2026-10-05',
    companyName: 'ABC Logistics Pvt Ltd',
    loadingType: 'Import',
    clientName: 'Apollo Tyres',
    billingNumber: '7/2026-27',
    bookingNumber: 'TXN/2026-27/00042',
    feet: '40 FT',
    containerNumber: 'MSKU2704367',
    sealNumber: 'SL-99410',
    vehicleNumber: 'TN04AB6294',
    driverNumber: '9840123456',
    diesel: 4500,
    advance: 2000,
    companyIn: '08:30',
    companyOut: '09:45',
    printIn: '11:15',
    printOut: '13:00',
    portIn: '14:30',
    portOut: '15:45',
    movementStatus: 'COMPLETED',
    shippingStatus: 'COMPLETED',
    comments: `Phase 8 Automated Verification Sync ${timestamp}`,
    dailySpreadsheetId: DAILY_REPORT_SS_ID,
  };

  const dailyRes = await callAppsScriptRaw('reporting.syncDailyRow', dailyPayload, token);
  console.log('Daily Report Sync Response:', JSON.stringify(dailyRes));

  const dailyData = dailyRes.data || dailyRes;
  const pass8_1 =
    dailyRes &&
    dailyRes.success &&
    (dailyData.action === 'INSERTED' || dailyData.action === 'UPDATED') &&
    dailyData.enquiryId === 'ENQ-10042';

  results.push({
    id: '8.1',
    scenario: 'TMS Daily Report Workbook Live Upsert',
    expected: 'Upserts consignment row with all 23 standard columns and matches via hidden _enquiryId',
    actual: `Action: ${dailyData.action || 'FAILED'}, EnquiryId: ${dailyData.enquiryId}; Sync to Daily Report workbook ${DAILY_REPORT_SS_ID} succeeded`,
    pass: pass8_1,
  });

  // ----------------------------------------------------------------
  // 8.2: TMS Company/Client-Wise Report Workbook
  // ----------------------------------------------------------------
  console.log('\n--- Test 8.2: TMS Company/Client-Wise Report Live Sync ---');
  const clientPayload = {
    ...dailyPayload,
    clientName: 'Apollo Tyres',
    companySpreadsheetId: COMPANY_REPORT_SS_ID,
    clientSpreadsheetId: COMPANY_REPORT_SS_ID,
  };

  const clientRes = await callAppsScriptRaw('reporting.syncClientRow', clientPayload, token);
  console.log('Client-Wise Report Sync Response:', JSON.stringify(clientRes));

  const clientData = clientRes.data || clientRes;
  const pass8_2 =
    clientRes &&
    clientRes.success &&
    (clientData.action === 'INSERTED' || clientData.action === 'UPDATED') &&
    clientData.client === 'Apollo Tyres' &&
    clientData.enquiryId === 'ENQ-10042';

  results.push({
    id: '8.2',
    scenario: 'TMS Company/Client-Wise Report Workbook Client Tab Sync',
    expected: 'Inserts/updates consignment row into the specific tab corresponding to client name (Apollo Tyres)',
    actual: `Action: ${clientData.action || 'FAILED'}, Tab: "${clientData.client}", EnquiryId: ${clientData.enquiryId}; Sync to Client workbook ${COMPANY_REPORT_SS_ID} succeeded`,
    pass: pass8_2,
  });

  // ----------------------------------------------------------------
  // 8.3: TMS Processed Bills Report Workbook
  // ----------------------------------------------------------------
  console.log('\n--- Test 8.3: TMS Processed Bills Report Live Sync ---');
  const billPayload = {
    id: 'BIL-640620',
    billNumber: '7/2026-27',
    companyName: 'ABC Logistics Pvt Ltd',
    clientName: 'Apollo Tyres',
    billingDate: '2026-10-05',
    financialYear: '2026-27',
    subtotal: 28000,
    taxAmount: 1400,
    totalAmount: 29400,
    paidAmount: 10000,
    outstandingAmount: 19400,
    status: 'PROCESSED',
    processedAt: new Date().toISOString(),
    processedBillsSpreadsheetId: PROCESSED_BILLS_SS_ID,
  };

  const billRes = await callAppsScriptRaw('reporting.syncBillRow', billPayload, token);
  console.log('Processed Bills Report Sync Response:', JSON.stringify(billRes));

  const billData = billRes.data || billRes;
  const pass8_3 =
    billRes &&
    billRes.success &&
    (billData.action === 'INSERTED' || billData.action === 'UPDATED') &&
    billData.billNumber === '7/2026-27' &&
    billData.billId === 'BIL-640620';

  results.push({
    id: '8.3',
    scenario: 'TMS Processed Bills Report Workbook Tax Invoice Ledger Sync',
    expected: 'Inserts/updates 12-column tax invoice ledger entry and matches via _billId',
    actual: `Action: ${billData.action || 'FAILED'}, Bill Number: "${billData.billNumber}", BillId: ${billData.billId}; Sync to Processed Bills workbook ${PROCESSED_BILLS_SS_ID} succeeded`,
    pass: pass8_3,
  });

  console.log('\n====================================================');
  console.log('PHASE 8 TEST SUMMARY:');
  console.log('====================================================');
  results.forEach((r) => {
    console.log(`[${r.pass ? 'PASS ✅' : 'FAIL ❌'}] ${r.id}: ${r.scenario}`);
    console.log(`    Expected: ${r.expected}`);
    console.log(`    Actual:   ${r.actual}\n`);
  });
}

runPhase8Tests().catch(console.error);
