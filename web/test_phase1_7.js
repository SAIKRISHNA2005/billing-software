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

async function testPhase1_7() {
  console.log('--- Testing 1.7: Asynchronous Non-Blocking Sync Latency ---');
  // Login
  await makeRequest('POST', '/api/auth/login', {
    email: 'admin@tms.local',
    password: 'Admin@12345',
  });

  // Get first enquiry ID
  const enqList = await makeRequest('GET', '/api/enquiries?page=1&limit=1');
  const firstEnq = enqList.body?.data?.items?.[0];
  if (!firstEnq) {
    console.log('No enquiry found to test update!');
    return;
  }

  console.log(`Testing non-blocking update on enquiry ID: ${firstEnq.id}...`);
  const updateRes = await makeRequest('PUT', `/api/enquiries/${firstEnq.id}`, {
    remarks: `Performance test timestamp: ${Date.now()}`
  });
  console.log(`Update status: ${updateRes.status}, duration: ${updateRes.duration}ms, success: ${updateRes.body?.success}`);
  const pass = updateRes.status === 200 && updateRes.body?.success;
  console.log(`Result 1.7: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
}

testPhase1_7().catch(console.error);
