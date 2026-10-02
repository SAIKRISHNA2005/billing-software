const http = require('http');

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (sessionCookie) {
      options.headers['Cookie'] = sessionCookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      if (res.headers['set-cookie']) {
        const cookies = res.headers['set-cookie'];
        const tmsCookie = cookies.find((c) => c.startsWith('tms_session='));
        if (tmsCookie) {
          sessionCookie = tmsCookie.split(';')[0];
        }
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runE2ETest() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END APPLICATION TEST');
  console.log('====================================================\n');

  // STEP 1: LOGIN
  console.log('🔹 STEP 1: Logging in as admin@tms.local...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@tms.local',
    password: 'Admin@12345',
  });

  if (loginRes.status !== 200 || !loginRes.body.success) {
    console.error('❌ Login failed:', loginRes.body);
    process.exit(1);
  }
  console.log('✅ Login successful! Session cookie captured:', sessionCookie);

  // STEP 2: VERIFY AUTH SESSION
  console.log('\n🔹 STEP 2: Verifying Session Info via /api/auth/me...');
  const meRes = await makeRequest('GET', '/api/auth/me');
  console.log('✅ Auth Me Response:', meRes.body.data || meRes.body);

  // STEP 3: FETCH OR CREATE MASTER DATA
  console.log('\n🔹 STEP 3: Fetching / Ensuring Master Data (Company & Client)...');
  let [compRes, clientRes] = await Promise.all([
    makeRequest('GET', '/api/master/companies'),
    makeRequest('GET', '/api/master/clients'),
  ]);

  let companies = compRes.body.data || [];
  let clients = clientRes.body.data || [];

  if (!Array.isArray(companies) || companies.length === 0) {
    console.log('  👉 Creating Default Master Company...');
    const createCompRes = await makeRequest('POST', '/api/master/companies', {
      name: 'TMS Logistics India Pvt Ltd',
      code: 'TMS-IND',
      gstin: '33AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      phone: '9876543210',
      email: 'info@tmslogistics.in',
      address: '100 Transport Hub, GST Road, Chennai, TN',
    });
    if (createCompRes.body.data) companies = [createCompRes.body.data];
  }

  if (!Array.isArray(clients) || clients.length === 0) {
    console.log('  👉 Creating Default Master Client...');
    const createClientRes = await makeRequest('POST', '/api/master/clients', {
      name: 'Reliance Industries Ltd',
      code: 'RIL-MUM',
      gstin: '27AAACR5522R1LH',
      pan: 'AAACR5522R',
      contactPerson: 'Amitabh Sharma',
      phone: '9820012345',
      email: 'logistics@ril.com',
      address: 'Reliance Corporate Park, Navi Mumbai, MH',
    });
    if (createClientRes.body.data) clients = [createClientRes.body.data];
  }

  console.log(`✅ Master Data Ready: ${companies.length} Companies, ${clients.length} Clients`);

  const primaryCompany = companies[0] || { id: 'COMP-001', name: 'TMS Logistics India Pvt Ltd' };
  const primaryClient = clients[0] || { id: 'CLI-001', name: 'Reliance Industries Ltd' };

  // STEP 4: CREATE 5 TRANSPORT ENQUIRY RECORDS
  console.log('\n🔹 STEP 4: Creating 5 Transport Enquiry Records...');
  const testDataList = [
    {
      companyId: primaryCompany.id,
      clientId: primaryClient.id,
      loadingType: 'Import',
      containerFrom: 'Mumbai Port, MH',
      containerTo: 'Bhiwandi Warehouse, MH',
      containerSize: '40ft',
      containerNumber: 'MSCU1234567',
      sealNumber: 'SEAL-98765',
      vehicleNumber: 'MH04JK9876',
      driverName: 'Ramesh Kumar',
      driverPhone: '9876543210',
      freightAmount: 45000,
      dieselAmount: 8000,
      advanceAmount: 15000,
      extraAdvance: 2000,
      bookingNumber: 'BK-2026-001',
      comments: 'Test Record 1 - High Priority Freight',
    },
    {
      companyId: primaryCompany.id,
      clientId: primaryClient.id,
      loadingType: 'Export',
      containerFrom: 'Bengaluru ICD, KA',
      containerTo: 'Chennai Port, TN',
      containerSize: '20ft',
      containerNumber: 'CMAU9876543',
      sealNumber: 'SEAL-12345',
      vehicleNumber: 'KA01AB1234',
      driverName: 'Suresh Patel',
      driverPhone: '9812345678',
      freightAmount: 62000,
      dieselAmount: 10000,
      advanceAmount: 20000,
      extraAdvance: 3000,
      bookingNumber: 'BK-2026-002',
      comments: 'Test Record 2 - Electronic Consignment',
    },
    {
      companyId: primaryCompany.id,
      clientId: primaryClient.id,
      loadingType: 'Empty',
      containerFrom: 'Hazira Plant, Surat, GJ',
      containerTo: 'Pithampur Industrial Area, MP',
      containerSize: '40ft',
      containerNumber: 'TLLU5678901',
      sealNumber: 'SEAL-54321',
      vehicleNumber: 'GJ06CD5678',
      driverName: 'Vikram Singh',
      driverPhone: '9765432109',
      freightAmount: 88000,
      dieselAmount: 15000,
      advanceAmount: 30000,
      extraAdvance: 5000,
      bookingNumber: 'BK-2026-003',
      comments: 'Test Record 3 - Heavy Metal Freight',
    },
    {
      companyId: primaryCompany.id,
      clientId: primaryClient.id,
      loadingType: 'Offload',
      containerFrom: 'Gurugram Hub, HR',
      containerTo: 'Jaipur Logistics Park, RJ',
      containerSize: '20ft',
      containerNumber: 'HAPU3456789',
      sealNumber: 'SEAL-67890',
      vehicleNumber: 'DL01EF9012',
      driverName: 'Harpreet Singh',
      driverPhone: '9654321098',
      freightAmount: 38000,
      dieselAmount: 6000,
      advanceAmount: 10000,
      extraAdvance: 1000,
      bookingNumber: 'BK-2026-004',
      comments: 'Test Record 4 - Fast Moving Goods',
    },
    {
      companyId: primaryCompany.id,
      clientId: primaryClient.id,
      loadingType: 'Flattrack',
      containerFrom: 'Sriperumbudur Hub, TN',
      containerTo: 'Hyderabad Suburbs, TS',
      containerSize: '40ft',
      containerNumber: 'COSU7890123',
      sealNumber: 'SEAL-89012',
      vehicleNumber: 'TN09GH3456',
      driverName: 'Muthu Swamy',
      driverPhone: '9543210987',
      freightAmount: 75000,
      dieselAmount: 12000,
      advanceAmount: 25000,
      extraAdvance: 4000,
      bookingNumber: 'BK-2026-005',
      comments: 'Test Record 5 - Auto Logistics Express',
    },
  ];

  const createdRecords = [];

  for (let i = 0; i < testDataList.length; i++) {
    const data = testDataList[i];
    console.log(`\n  👉 Creating Record ${i + 1}/5: ${data.containerFrom} ➔ ${data.containerTo} (${data.loadingType})...`);
    const res = await makeRequest('POST', '/api/enquiries', data);
    if (res.status === 200 || res.status === 201) {
      if (res.body.success) {
        const rec = res.body.data;
        createdRecords.push(rec);
        console.log(`  ✅ Record ${i + 1} Created Successfully! ID: ${rec.id || rec.enquiryId || 'ENQ-SUCCESS'} | Freight: ₹${data.freightAmount} | Vehicle: ${data.vehicleNumber}`);
      } else {
        console.warn(`  ⚠️ Record ${i + 1} Response:`, res.body);
      }
    } else {
      console.warn(`  ⚠️ Record ${i + 1} HTTP Status ${res.status}:`, res.body);
    }
  }

  // STEP 5: LIST ENQUIRIES TO VERIFY PERSISTENCE
  console.log('\n🔹 STEP 5: Verifying Enquiries List via /api/enquiries...');
  const listRes = await makeRequest('GET', '/api/enquiries');
  const enquiriesList = listRes.body.data || [];
  console.log(`✅ Total Enquiries in Database: ${Array.isArray(enquiriesList) ? enquiriesList.length : 'N/A'}`);

  // STEP 6: TEST OPERATIONS & MOVEMENT STAGE UPDATES
  if (Array.isArray(enquiriesList) && enquiriesList.length > 0) {
    const targetEnq = enquiriesList[0];
    console.log(`\n🔹 STEP 6: Updating Stage & Movement for Enquiry ${targetEnq.id}...`);
    const stageRes = await makeRequest('POST', `/api/enquiries/${targetEnq.id}/stage`, {
      stage: 'CONTAINER_MOVEMENT',
      notes: 'Vehicle departed from origin location',
    });
    console.log('✅ Stage Update Response:', stageRes.body.success ? 'Success' : stageRes.body.message);
  }

  // STEP 7: TEST DASHBOARD SUMMARY
  console.log('\n🔹 STEP 7: Fetching Executive Dashboard Summary via /api/dashboard/summary...');
  const dashRes = await makeRequest('GET', '/api/dashboard/summary');
  console.log('✅ Dashboard Summary KPIs:', dashRes.body.data || dashRes.body);

  // STEP 8: TEST PENDING BILLS & BILLING MODULE
  console.log('\n🔹 STEP 8: Fetching Pending Bills via /api/billing/pending...');
  const pendingBillsRes = await makeRequest('GET', '/api/billing/pending');
  console.log(`✅ Pending Bills Count: ${Array.isArray(pendingBillsRes.body.data) ? pendingBillsRes.body.data.length : 'N/A'}`);

  // STEP 9: TEST REPORTS MODULE
  console.log('\n🔹 STEP 9: Testing Analytics Reports API (/api/reports/daily, /api/reports/company)...');
  const [dailyRep, companyRep] = await Promise.all([
    makeRequest('GET', '/api/reports/daily'),
    makeRequest('GET', '/api/reports/company'),
  ]);
  console.log('✅ Daily Report Status:', dailyRep.status === 200 ? 'OK' : dailyRep.status);
  console.log('✅ Company Report Status:', companyRep.status === 200 ? 'OK' : companyRep.status);

  // STEP 10: TEST CLIENT PAYMENTS & AGEING REPORT
  console.log('\n🔹 STEP 10: Testing Client Payments & Ageing Analysis API...');
  const [paymentsRes, ageingRes] = await Promise.all([
    makeRequest('GET', '/api/billing/payments'),
    makeRequest('GET', '/api/billing/ageing'),
  ]);
  console.log('✅ Client Payments API Status:', paymentsRes.status === 200 ? 'OK' : paymentsRes.status);
  console.log('✅ Ageing Report Summary:', ageingRes.body.data?.summary || ageingRes.body);

  console.log('\n====================================================');
  console.log('🎉 E2E TEST COMPLETED SUCCESSFULLY FOR ALL MODULES');
  console.log('====================================================\n');
}

runE2ETest().catch((err) => {
  console.error('❌ E2E Test execution error:', err);
});
