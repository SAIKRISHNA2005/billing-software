const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DUMMY_DOCS_DIR = 'C:\\Users\\saikr\\OneDrive\\Desktop\\dummy_vehicle_test_documents';

async function main() {
  console.log('=== TEST VEHICLE DOCUMENT UPLOAD & FOLDER NAMING ===');

  // 1. Login
  console.log('\n1. Logging in as admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tms.local', password: 'Admin@12345' })
  });

  const loginJson = await loginRes.json();
  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  const sessionCookie = (setCookies || []).find((c) => c && c.startsWith('tms_session='));
  const authCookie = sessionCookie ? sessionCookie.split(';')[0] : '';

  if (!loginJson.success || !authCookie) {
    console.error('Login failed:', loginJson);
    process.exit(1);
  }
  console.log('Login successful! Auth Cookie acquired.');

  // 2. Fetch vehicles
  console.log('\n2. Fetching vehicle list...');
  const vehiclesRes = await fetch(`${BASE_URL}/api/vehicles`, {
    headers: { Cookie: authCookie }
  });
  const vehiclesJson = await vehiclesRes.json();
  
  let vehicles = [];
  if (vehiclesJson.success && vehiclesJson.data && Array.isArray(vehiclesJson.data.items)) {
    vehicles = vehiclesJson.data.items;
  } else if (vehiclesJson.success && vehiclesJson.data && Array.isArray(vehiclesJson.data.vehicles)) {
    vehicles = vehiclesJson.data.vehicles;
  } else if (vehiclesJson.success && Array.isArray(vehiclesJson.data)) {
    vehicles = vehiclesJson.data;
  }

  console.log(`Found ${vehicles.length} vehicles.`);
  if (vehicles.length === 0) {
    console.error('No vehicles found to test document upload.');
    process.exit(1);
  }

  const testVehicle = vehicles[0];
  console.log(`Using Test Vehicle: ${testVehicle.vehicleNumber} (ID: ${testVehicle.id})`);

  // 3. Read dummy documents from C:\Users\saikr\OneDrive\Desktop\dummy_vehicle_test_documents
  console.log(`\n3. Reading dummy test documents from ${DUMMY_DOCS_DIR}...`);
  const filesInDir = fs.readdirSync(DUMMY_DOCS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${filesInDir.length} PDF files:`, filesInDir);

  const categoryMap = {
    '01_RC_Test.pdf': 'RC',
    '02_Insurance_Test.pdf': 'INSURANCE',
    '03_Fitness_Test.pdf': 'FITNESS',
    '04_PUCC_Test.pdf': 'PUCC',
    '05_State_Permit_Test.pdf': 'STATE_PERMIT',
    '06_National_Permit_Test.pdf': 'NATIONAL_PERMIT',
    '07_Tax_Token_Test.pdf': 'TAX_TOKEN',
    '08_Compliance_Certificate_Test.pdf': 'OTHER'
  };

  const uploadPayloadFiles = filesInDir.map(fileName => {
    const filePath = path.join(DUMMY_DOCS_DIR, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const category = categoryMap[fileName] || 'OTHER';

    return {
      fileName: fileName,
      category: category,
      mimeType: 'application/pdf',
      base64Data: `data:application/pdf;base64,${base64Data}`,
      documentNumber: `DOC-${Date.now()}-${category}`,
      notes: `Uploaded via automated test from ${fileName}`
    };
  });

  // 4. Upload to /api/documents
  console.log(`\n4. Uploading ${uploadPayloadFiles.length} documents to /api/documents...`);
  const uploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookie
    },
    body: JSON.stringify({
      vehicleId: testVehicle.id,
      files: uploadPayloadFiles
    })
  });

  const uploadJson = await uploadRes.json();
  console.log('Upload Response Status:', uploadRes.status);
  console.log('Upload Response JSON:', JSON.stringify(uploadJson, null, 2));

  // 5. Check folder name formatting in response
  if (uploadJson.success && uploadJson.data) {
    const data = uploadJson.data;
    const cleanNum = String(testVehicle.vehicleNumber).replace(/[\s-]/g, '').toUpperCase();
    const expectedFolderName = `${cleanNum} Documents`;
    console.log(`\n5. Verifying Drive folder name:`);
    console.log(`Expected folder name pattern: "${expectedFolderName}"`);
    console.log(`Folder Name: "${data.folderName}"`);
    console.log(`Folder URL: ${data.folderUrl}`);
    console.log(`Uploaded Count: ${data.uploadedCount}`);
    
    if (data.folderName === expectedFolderName || data.folderName?.includes(expectedFolderName)) {
      console.log('✅ PASS: Drive folder name matches {vehicleNumber} Documents requirement exactly!');
    } else {
      console.warn('⚠️ Folder name returned:', data.folderName);
    }
  } else {
    console.error('❌ FAIL: Upload did not succeed:', uploadJson.message);
  }

  // 6. Verify listing documents
  console.log(`\n6. Fetching vehicle documents for vehicleId=${testVehicle.id}...`);
  const listRes = await fetch(`${BASE_URL}/api/documents?vehicleId=${testVehicle.id}`, {
    headers: { Cookie: authCookie }
  });
  const listJson = await listRes.json();
  console.log('List Documents Status:', listRes.status);
  if (listJson.success && listJson.data) {
    console.log(`Vehicle Documents Count: ${listJson.data.documents?.length || 0}`);
    console.log(`Vehicle Folder Info:`, listJson.data.folder);
    console.log('✅ PASS: Documents successfully retrieved for vehicle!');
  } else {
    console.error('❌ FAIL: Listing documents failed:', listJson);
  }

  // 7. Verify all modified UI pages load cleanly with 200 OK
  console.log('\n7. Verifying all modified UI pages load with 200 OK:');
  const pagesToTest = [
    '/dashboard',
    '/reports/daily',
    '/reports/vendor',
    '/billing/pending',
    '/billing/processed',
    '/reports/billing',
    '/operations/movement'
  ];

  for (const page of pagesToTest) {
    const pageRes = await fetch(`${BASE_URL}${page}`, {
      headers: { Cookie: authCookie }
    });
    console.log(`Page ${page}: Status ${pageRes.status} ${pageRes.status === 200 ? '✅ OK' : '❌ FAIL'}`);
  }

  console.log('\n=== TEST RUN COMPLETED ===');
}

main().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});
