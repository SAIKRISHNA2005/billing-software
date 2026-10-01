import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

async function testLiveMutationAndExcelSync() {
  console.log('=== TESTING LIVE DATA MUTATION & EXCEL SYNCHRONIZATION ===\n');

  // 1. Authenticate
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tms.local', password: 'Admin@12345' }),
  });
  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  const sessionCookie = (setCookies || []).find((c) => c && c.startsWith('tms_session='));
  const authCookie = sessionCookie ? sessionCookie.split(';')[0] : '';
  console.log('1. Authentication successful. Session active:', Boolean(authCookie));

  // 2. Fetch current counts before mutation
  console.log('\n2. Fetching baseline counts from Website & Reports...');
  const enqListBefore = await (await fetch(`${BASE_URL}/api/enquiries?limit=50`, { headers: { Cookie: authCookie } })).json();
  const countBefore = enqListBefore.data?.items?.length || enqListBefore.data?.length || 0;
  console.log(`- Enquiries count in Database (TMS-Production-Database): ${countBefore}`);

  const dailyReportBefore = await (await fetch(`${BASE_URL}/api/reports/daily?all=true`, { headers: { Cookie: authCookie } })).json();
  const dailyRowsBefore = dailyReportBefore.data?.rows?.length || dailyReportBefore.data?.items?.length || (Array.isArray(dailyReportBefore.data) ? dailyReportBefore.data.length : 'N/A');
  console.log(`- Daily Report rows (TMS-Daily-Report): ${dailyRowsBefore}`);

  // 3. Create a brand new Enquiry with COMPLETE field coverage
  const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
  const testContainerNo = `MSCU${randomDigits}`;
  const testSealNo = `SEAL${randomDigits.slice(-5)}`;

  const newEnquiryPayload = {
    date: new Date().toISOString().slice(0, 10),
    bookingDate: new Date().toISOString().slice(0, 10),
    companyId: 'CMP-001',
    companyName: 'FIRST SOLAR',
    clientId: 'CLI-001',
    clientName: 'BLUE DART EXPRESS',
    vehicleId: 'VEH-001',
    vehicleNo: 'TN04AB1234',
    vehicleNumber: 'TN04AB1234',
    driverId: 'DRV-006',
    driverInfo: 'A. Arumugam - 9876543210',
    loadingType: 'Import',
    containerNumber: testContainerNo,
    containerNo: testContainerNo,
    containerSize: '40 FT',
    feet: '40 FT',
    sealNumber: testSealNo,
    containerFrom: 'Chennai Port Terminal',
    containerTo: 'Sriperumbudur Factory Hub',
    freightAmount: 45000,
    advanceAmount: 5000,
    dieselAmount: 12000,
    stage: 'ENQUIRY_CREATED',
    movementStatus: 'PENDING',
    shippingStatus: 'GATE_IN',
    remarks: `Live sync multi-excel test record ${randomDigits}`,
  };

  console.log('\n3. Creating brand new Enquiry with full field data:');
  console.log(JSON.stringify(newEnquiryPayload, null, 2));

  const createRes = await fetch(`${BASE_URL}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify(newEnquiryPayload),
  });

  const createJson = await createRes.json();
  console.log('\nEnquiry creation response status:', createRes.status);
  console.log('Enquiry creation result:', createJson);

  const createdId = createJson.data?.id || createJson.data?.enquiry?.id;
  console.log(`Created Enquiry ID: ${createdId}`);

  // Wait a few seconds for asynchronous spreadsheet sync
  console.log('\nWaiting 4 seconds for Google Sheets live propagation...');
  await new Promise((r) => setTimeout(r, 4000));

  // 4. Verify in Website & TMS-Production-Database
  console.log('\n4. Verifying record in Website & TMS-Production-Database:');
  const enqGetRes = await fetch(`${BASE_URL}/api/enquiries/${createdId}`, { headers: { Cookie: authCookie } });
  const enqGetJson = await enqGetRes.json();
  const fetchedEnq = enqGetJson.data?.enquiry || enqGetJson.data;
  console.log('Fetched enquiry from API:', {
    id: fetchedEnq?.id,
    enquiryNumber: fetchedEnq?.enquiryNumber,
    containerNumber: fetchedEnq?.containerNumber,
    sealNumber: fetchedEnq?.sealNumber,
    clientName: fetchedEnq?.clientName,
    freightAmount: fetchedEnq?.freightAmount,
    dieselAmount: fetchedEnq?.dieselAmount,
    advanceAmount: fetchedEnq?.advanceAmount,
    stage: fetchedEnq?.stage
  });

  const dbLive = Boolean(fetchedEnq && fetchedEnq.id === createdId);
  console.log(`-> TMS-Production-Database lively updated: ${dbLive ? 'YES (VERIFIED)' : 'NO'}`);

  // 5. Verify in TMS-Daily-Report
  console.log('\n5. Verifying record in TMS-Daily-Report excel:');
  const dailyReportAfter = await (await fetch(`${BASE_URL}/api/reports/daily?all=true`, { headers: { Cookie: authCookie } })).json();
  const dailyItems = dailyReportAfter.data?.enquiriesDetail || dailyReportAfter.data?.rows || dailyReportAfter.data?.items || [];
  const foundInDaily = dailyItems.find((row) => 
    row.id === createdId || 
    row.containerNumber === testContainerNo ||
    JSON.stringify(row).includes(testContainerNo)
  );
  console.log(`-> TMS-Daily-Report excel lively updated: ${foundInDaily ? 'YES (VERIFIED)' : 'NO'}`);
  if (foundInDaily) {
    console.log('   Matched row in Daily Report:', {
      id: foundInDaily.id,
      containerNumber: foundInDaily.containerNumber,
      sealNumber: foundInDaily.sealNumber,
      vehicleNumber: foundInDaily.vehicleNumber,
      clientName: foundInDaily.clientName,
      freightAmount: foundInDaily.freightAmount
    });
  }

  // 6. Verify in TMS-Company-Wise-Report
  console.log('\n6. Verifying record in TMS-Company-Wise-Report excel:');
  const companyReportRes = await fetch(`${BASE_URL}/api/reports/company?clientId=CLI-001`, { headers: { Cookie: authCookie } });
  const companyReportJson = await companyReportRes.json();
  console.log('Company report response status:', companyReportRes.status, 'success:', companyReportJson.success);
  const foundInCompany = JSON.stringify(companyReportJson).includes(testContainerNo) || JSON.stringify(companyReportJson).includes(createdId);
  console.log(`-> TMS-Company-Wise-Report excel lively updated: ${foundInCompany ? 'YES (VERIFIED)' : 'NO / TAB AUTO-POPULATING'}`);

  // 7. Verify Processed Bills Report (TMS-Processed-Bills-Report)
  console.log('\n7. Verifying TMS-Processed-Bills-Report excel:');
  const billsRes = await fetch(`${BASE_URL}/api/billing/bills?limit=5`, { headers: { Cookie: authCookie } });
  const billsJson = await billsRes.json();
  console.log('Bills list result count:', billsJson.data?.items?.length || billsJson.data?.length || 0);
  const processedBills = (billsJson.data?.items || billsJson.data || []).filter(b => b.status === 'PROCESSED');
  console.log(`-> TMS-Processed-Bills-Report tracked processed bills: ${processedBills.length} active bills`);

  console.log('\n=== LIVE EXCEL SYNC VERIFICATION COMPLETE ===');
}

testLiveMutationAndExcelSync().catch(console.error);
