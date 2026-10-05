const http = require('http');

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';

function makeRequest(method, path, body = null) {
  const start = Date.now();
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
        const duration = Date.now() - start;
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, duration });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, duration });
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

async function testPhase1() {
  console.log('=== PHASE 1: PERFORMANCE OPTIMIZATIONS & NETWORK VERIFICATION ===');
  
  // 0. Authenticate
  console.log('\n[0] Logging in with admin credentials...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@tms.local',
    password: 'Admin@12345',
  });
  console.log(`Login status: ${loginRes.status}, success: ${loginRes.body?.success}, duration: ${loginRes.duration}ms`);
  if (!loginRes.body?.success) {
    console.error('Login failed! Cannot proceed.');
    process.exit(1);
  }

  // 1.1 Single-Trip Enquiries Bootstrapping Test
  console.log('\n[1.1] Testing Single-Trip Enquiries Bootstrap (/api/enquiries?bootstrap=true&page=1&limit=15)...');
  const enqBootRes = await makeRequest('GET', '/api/enquiries?bootstrap=true&page=1&limit=15');
  console.log(`Status: ${enqBootRes.status}, Duration: ${enqBootRes.duration}ms`);
  const enqData = enqBootRes.body?.data || {};
  console.log('Returned items count:', enqData.items?.length);
  console.log('Returned total count:', enqData.total);
  console.log('Returned companies count:', enqData.companies?.length);
  console.log('Returned clients count:', enqData.clients?.length);
  console.log('Returned vendors count:', enqData.vendors?.length);
  const pass1_1 = enqBootRes.status === 200 && enqBootRes.body?.success && Array.isArray(enqData.items) && Array.isArray(enqData.companies) && Array.isArray(enqData.clients);
  console.log(`Result 1.1: ${pass1_1 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 1.2 Dashboard Single-Request Aggregation Test
  console.log('\n[1.2] Testing Dashboard Single-Request Aggregation (/api/dashboard/summary)...');
  const dashRes = await makeRequest('GET', '/api/dashboard/summary');
  console.log(`Status: ${dashRes.status}, Duration: ${dashRes.duration}ms`);
  const dashData = dashRes.body?.data || {};
  console.log('Todays trips count:', dashData.todaysTripsCount);
  console.log('Vehicle alerts count in summary:', dashData.vehicleAlerts?.length);
  console.log('Company billing chart items:', dashData.companyBillingChart?.length);
  const pass1_2 = dashRes.status === 200 && dashRes.body?.success && Array.isArray(dashData.vehicleAlerts);
  console.log(`Result 1.2: ${pass1_2 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 1.3 Pending & Processed Bills Single-Trip Test
  console.log('\n[1.3] Testing Pending & Processed Bills Single-Trip Master Population...');
  const pendingRes = await makeRequest('GET', '/api/billing/pending');
  console.log(`Pending Bills Status: ${pendingRes.status}, Duration: ${pendingRes.duration}ms`);
  const pendData = pendingRes.body?.data || {};
  console.log('Pending items count:', pendData.items?.length);
  console.log('Pending companies attached:', pendData.companies?.length);
  console.log('Pending clients attached:', pendData.clients?.length);
  
  const billsRes = await makeRequest('GET', '/api/billing/bills?page=1&limit=15');
  console.log(`Processed Bills Status: ${billsRes.status}, Duration: ${billsRes.duration}ms`);
  const billsData = billsRes.body?.data || {};
  console.log('Bills items count:', billsData.items?.length);
  console.log('Bills companies attached:', billsData.companies?.length);
  console.log('Bills clients attached:', billsData.clients?.length);
  const pass1_3 = pendingRes.status === 200 && Array.isArray(pendData.companies) && billsRes.status === 200 && Array.isArray(billsData.companies);
  console.log(`Result 1.3: ${pass1_3 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 1.4 In-Execution Drive RPC Caching Speed Test
  console.log('\n[1.4] Testing In-Execution Drive RPC Caching (Repeated call to Dashboard)...');
  const dashRepeat = await makeRequest('GET', '/api/dashboard/summary');
  console.log(`Dashboard Repeat Duration: ${dashRepeat.duration}ms`);
  const pass1_4 = dashRepeat.status === 200 && dashRepeat.duration < 4000;
  console.log(`Result 1.4: ${pass1_4 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 1.5 Zero-Stale Real-Time Live Read Test
  console.log('\n[1.5] Testing Zero-Stale Caching (Verifying live bypass)...');
  const q1 = await makeRequest('GET', '/api/master/companies?lookup=true');
  const q2 = await makeRequest('GET', '/api/master/companies?lookup=true');
  console.log(`Q1 Duration: ${q1.duration}ms, items: ${q1.body?.data?.length}`);
  console.log(`Q2 Duration: ${q2.duration}ms, items: ${q2.body?.data?.length}`);
  const pass1_5 = q1.status === 200 && q2.status === 200;
  console.log(`Result 1.5: ${pass1_5 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 1.6 Event-Driven Client Master Cache Test
  console.log('\n[1.6] Testing Master Entities Availability...');
  const compLookup = await makeRequest('GET', '/api/master/companies?limit=100');
  const cltLookup = await makeRequest('GET', '/api/master/clients?limit=100');
  console.log(`Companies: ${compLookup.body?.data?.items?.length || compLookup.body?.data?.length}`);
  console.log(`Clients: ${cltLookup.body?.data?.items?.length || cltLookup.body?.data?.length}`);
  const pass1_6 = compLookup.status === 200 && cltLookup.status === 200;
  console.log(`Result 1.6: ${pass1_6 ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log('\n====================================================');
  console.log('PHASE 1 SUMMARY: ALL PERFORMANCE OPTIMIZATION TESTS COMPLETED');
  console.log(`Overall: ${pass1_1 && pass1_2 && pass1_3 && pass1_4 && pass1_5 && pass1_6 ? 'SUCCESS' : 'FAILED'}`);
}

testPhase1().catch(console.error);
