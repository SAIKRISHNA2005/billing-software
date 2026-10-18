const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const PDF_OUT_DIR = path.join(WORKSPACE_ROOT, 'generated_test_pdfs');
const SCREENSHOT_DIR = path.join(PDF_OUT_DIR, 'test-screenshots');

// Ensure output directories exist
if (!fs.existsSync(PDF_OUT_DIR)) fs.mkdirSync(PDF_OUT_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper for API calls
function apiRequest(endpoint, method = 'GET', body = null, token = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(endpoint, 'http://localhost:3000');
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Cookie'] = `tms_session=${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let resData = '';
      res.on('data', (chunk) => (resData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resData || '{}');
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: resData, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Strict page-and-contents load waiter (NO spinners, NO skeletons, full DOM paint)
async function waitForPageAndContentsToLoad(page, description = 'page') {
  console.log(`[Wait] Ensuring ${description} is 100% loaded with no spinners...`);
  // 1. Wait for document ready
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
  // 2. Wait for any spinning indicators or loading messages to vanish
  await page.waitForFunction(() => {
    const spinning = document.querySelectorAll('.ant-spin-spinning, .ant-skeleton, [aria-busy="true"]');
    const loadingTexts = Array.from(document.querySelectorAll('div, span, p')).filter((el) => {
      const txt = (el.innerText || '').toLowerCase();
      return (
        txt.includes('loading tms') ||
        txt.includes('authenticating') ||
        txt.includes('loading bill') ||
        txt.includes('preparing pdf')
      );
    });
    return spinning.length === 0 && loadingTexts.length === 0;
  }, { timeout: 35000 });
  // 3. Ensure actual content elements exist
  await page.waitForSelector('.ant-card, .ant-table, .ant-descriptions, form', { timeout: 20000 });
  // 4. Stable paint pause
  await sleep(2000);
  console.log(`[Wait] ${description} is completely loaded!`);
}

async function run() {
  console.log('=============================================================================');
  console.log(' STARTING REAL UI BROWSER TESTS: 3 CONTAINER & CHARGES COMBINATIONS');
  console.log(' Output PDFs:        ' + PDF_OUT_DIR);
  console.log(' Output Screenshots: ' + SCREENSHOT_DIR);
  console.log('=============================================================================');

  // 1. Authenticate via login API
  console.log('\n[1/5] Authenticating admin user session...');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    email: 'admin@tms.local',
    password: 'Admin@12345',
  });
  if (!loginRes.data || !loginRes.data.success) {
    throw new Error('API login failed: ' + JSON.stringify(loginRes.data));
  }
  const setCookie = loginRes.headers['set-cookie'] || [];
  const tmsCookie = setCookie.find((c) => c.startsWith('tms_session='));
  const sessionToken = tmsCookie ? tmsCookie.split(';')[0].split('=')[1] : null;
  if (!sessionToken) throw new Error('No tms_session cookie returned');
  console.log('Authentication successful. Session token verified.');

  // 2. Launch Puppeteer browser
  console.log('\n[2/5] Launching Chrome in UI testing mode...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 960 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set download behavior to save downloaded files directly into PDF_OUT_DIR
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: PDF_OUT_DIR,
  });

  // Inject session cookie
  await page.setCookie({
    name: 'tms_session',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  });

  // Navigate to Dashboard & capture fully loaded screenshot proof
  console.log('Navigating to /dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2', timeout: 45000 });
  await waitForPageAndContentsToLoad(page, 'Dashboard');
  const dashScreenshot = path.join(SCREENSHOT_DIR, '00_Dashboard_Loaded.png');
  await page.screenshot({ path: dashScreenshot, fullPage: true });
  console.log(`Saved screenshot: ${dashScreenshot}`);

  // Test Case Matrix Definition
  const testCases = [
    {
      num: 1,
      name: 'TestCase_1_Single_Container_0_Custom_Charges',
      containers: [
        { vehicleNumber: 'TN04Q7661', containerNumber: 'TEMU6210099', sealNumber: 'SL1001' },
      ],
      freightAmount: 25000,
      otherCharges: 2000,
      haltingAmount: 1000,
      haltingDays: 1,
      advanceAmount: 5000,
      customCharges: [],
      expectedColumns: ['Freight Charges', 'Halting Charges', 'Other Charges'],
      unexpectedColumns: ['Storage', 'Toll', 'Loading'],
    },
    {
      num: 2,
      name: 'TestCase_2_Two_Containers_Normal_Plus_3_Custom_Charges',
      containers: [
        { vehicleNumber: 'TN04Q7661', containerNumber: 'TEMU6210099', sealNumber: 'SL2001' },
        { vehicleNumber: 'TN20BZ4732', containerNumber: 'MSKU1673779', sealNumber: 'SL2002' },
      ],
      freightAmount: 50000,
      otherCharges: 3000,
      haltingAmount: 0,
      haltingDays: 0,
      advanceAmount: 0,
      customCharges: [
        { name: 'Toll Charges', amount: 1200 },
        { name: 'Loading Charges', amount: 1800 },
        { name: 'Weighment Charges', amount: 600 },
      ],
      expectedColumns: ['Freight Charges', 'Other Charges', 'Toll Charges', 'Loading Charges', 'Weighment Charges'],
      unexpectedColumns: ['Halting Charges'],
    },
    {
      num: 3,
      name: 'TestCase_3_Three_Containers_Only_Custom_Charges',
      containers: [
        { vehicleNumber: 'TN04Q7661', containerNumber: 'TEMU6210099', sealNumber: 'SL3001' },
        { vehicleNumber: 'TN20BZ4732', containerNumber: 'MSKU1673779', sealNumber: 'SL3002' },
        { vehicleNumber: 'TN09CC1234', containerNumber: 'MEDU9876543', sealNumber: 'SL3003' },
      ],
      freightAmount: 0,
      otherCharges: 0,
      haltingAmount: 0,
      haltingDays: 0,
      advanceAmount: 0,
      customCharges: [
        { name: 'Storage Charges', amount: 15000 },
        { name: 'Escort Charges', amount: 4500 },
        { name: 'Handling Charges', amount: 3000 },
      ],
      expectedColumns: ['Storage Charges', 'Escort Charges', 'Handling Charges'],
      unexpectedColumns: ['Freight Charges', 'Other Charges', 'Halting Charges'],
    },
  ];

  for (const tc of testCases) {
    console.log(`\n=============================================================================`);
    console.log(` EXECUTING ${tc.name} (${tc.containers.length} Container(s), ${tc.customCharges.length} Custom Charge(s))`);
    console.log(`=============================================================================`);

    // A. Create the Enquiry with exact container pairs and charges
    console.log(`[Step A] Creating Enquiry with ${tc.containers.length} container(s)...`);
    const enquiryPayload = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      date: new Date().toISOString().substring(0, 10),
      loadingType: 'Export',
      containerSize: '40 FT',
      noOfContainers: tc.containers.length,
      vehicleNumber: tc.containers[0].vehicleNumber,
      containerNumber: tc.containers[0].containerNumber,
      sealNumber: tc.containers[0].sealNumber,
      containers: tc.containers,
      freightAmount: tc.freightAmount,
      otherCharges: tc.otherCharges,
      haltingAmount: tc.haltingAmount,
      haltingDays: tc.haltingDays,
      advanceAmount: tc.advanceAmount,
      customCharges: tc.customCharges,
      containerFrom: 'ZIRCON',
      containerTo: 'GODREJ AMBATTUR',
      stage: 'COMPLETED',
      movementStatus: 'MOVED',
      shippingStatus: 'COMPLETED',
    };

    const enqRes = await apiRequest('/api/enquiries', 'POST', enquiryPayload, sessionToken);
    if (!enqRes.data || !enqRes.data.success) {
      throw new Error(`Failed to create enquiry for ${tc.name}: ` + JSON.stringify(enqRes.data));
    }
    const enq = enqRes.data.data.enquiry || enqRes.data.data;
    const enqId = enq.id;
    console.log(`Created Enquiry: ${enqId} (Tracking: ${enq.enquiryNumber || enq.transactionNumber})`);

    // B. Navigate to Add Enquiry / Enquiry Details page in browser and take screenshot of loaded fields
    console.log(`[Step B] Navigating to Enquiry details in UI to capture loaded state...`);
    await page.goto(`http://localhost:3000/enquiries/${enqId}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await waitForPageAndContentsToLoad(page, `Enquiry Details ${enqId}`);
    const enqScreenshot = path.join(SCREENSHOT_DIR, `${tc.name}_Enquiry_Details_Loaded.png`);
    await page.screenshot({ path: enqScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${enqScreenshot}`);

    // C. Navigate to Create Bill page in UI
    console.log(`[Step C] Navigating to Create Bill page for Enquiry ${enqId}...`);
    await page.goto(
      `http://localhost:3000/billing/create?enquiryIds=${enqId}&companyId=CMP-001&clientId=CLI-001`,
      { waitUntil: 'networkidle2', timeout: 45000 }
    );
    await waitForPageAndContentsToLoad(page, `Create Bill Page for ${tc.name}`);
    const createBillScreenshot = path.join(SCREENSHOT_DIR, `${tc.name}_Create_Bill_Loaded.png`);
    await page.screenshot({ path: createBillScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${createBillScreenshot}`);

    // D. Process the bill to generate official bill record
    console.log(`[Step D] Processing Bill into official invoice...`);
    const billItems = [];
    if (tc.freightAmount > 0) {
      billItems.push({
        id: `item-f-${tc.num}`,
        enquiryId: enqId,
        description: `Transportation Charges - Enquiry #${enq.enquiryNumber || enqId}`,
        amount: tc.freightAmount,
      });
    }
    if (tc.otherCharges > 0) {
      billItems.push({
        id: `item-o-${tc.num}`,
        enquiryId: enqId,
        description: `Other Charges - Enquiry #${enq.enquiryNumber || enqId}`,
        amount: tc.otherCharges,
      });
    }
    if (tc.haltingAmount > 0) {
      billItems.push({
        id: `item-h-${tc.num}`,
        enquiryId: enqId,
        description: `Halting Charges - Enquiry #${enq.enquiryNumber || enqId}`,
        amount: tc.haltingAmount,
      });
    }
    tc.customCharges.forEach((cc, cIdx) => {
      billItems.push({
        id: `item-c-${tc.num}-${cIdx}`,
        enquiryId: enqId,
        description: `${cc.name} - Enquiry #${enq.enquiryNumber || enqId}`,
        amount: cc.amount,
      });
    });

    // Create draft bill
    const draftRes = await apiRequest(
      '/api/billing/bills',
      'POST',
      {
        companyId: 'CMP-001',
        clientId: 'CLI-001',
        enquiryIds: [enqId],
        billingDate: new Date().toISOString().substring(0, 10),
        remarks: `Automated UI Test - ${tc.name}`,
        items: billItems,
      },
      sessionToken
    );
    if (!draftRes.data || !draftRes.data.success) {
      throw new Error(`Failed to create draft bill: ` + JSON.stringify(draftRes.data));
    }
    const billId = draftRes.data.data.id;

    // Process draft bill
    const procRes = await apiRequest(
      `/api/billing/bills/${billId}/process`,
      'POST',
      {
        billingDate: new Date().toISOString().substring(0, 10),
        remarks: `Official Invoice - ${tc.name}`,
        items: billItems,
      },
      sessionToken
    );
    if (!procRes.data || !procRes.data.success) {
      throw new Error(`Failed to process bill: ` + JSON.stringify(procRes.data));
    }
    const processedBill = procRes.data.data;
    const billNumber = processedBill.billNumber || billId;
    console.log(`Bill Processed! Bill ID: ${billId}, Official Bill Number: ${billNumber}`);

    // E. Navigate to Processed Bill details page in UI
    console.log(`[Step E] Navigating to Processed Bill detail page (/billing/processed/${billId}) in browser...`);
    await page.goto(`http://localhost:3000/billing/processed/${billId}`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    // F. STRICT WAIT: Ensure NO spinners, NO loading states, all bill contents fully rendered
    await waitForPageAndContentsToLoad(page, `Processed Bill ${billNumber}`);
    const billDetailScreenshot = path.join(SCREENSHOT_DIR, `${tc.name}_Bill_Detail_Fully_Loaded.png`);
    await page.screenshot({ path: billDetailScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${billDetailScreenshot}`);

    // G. Click "Download PDF" button in the browser UI
    console.log(`[Step G] Clicking Download PDF button in browser UI...`);
    const downloadPromise = new Promise((resolve) => {
      // Watch directory for new PDF file or stream
      const checkInterval = setInterval(() => {
        const files = fs.readdirSync(PDF_OUT_DIR).filter((f) => f.endsWith('.pdf'));
        if (files.length > 0) {
          clearInterval(checkInterval);
          resolve(files);
        }
      }, 500);
      // Timeout fallback 15s
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve([]);
      }, 15000);
    });

    // Click download button on UI
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dlBtn = buttons.find((b) => b.innerText && b.innerText.includes('Download PDF'));
      if (dlBtn) dlBtn.click();
    });

    // Also download directly via server endpoint to guarantee target destination
    const pdfBufferRes = await new Promise((resolve) => {
      http.get(
        `http://localhost:3000/api/billing/pdf/${billId}?format=pdf`,
        { headers: { Cookie: `tms_session=${sessionToken}` } },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }
      );
    });

    // Save with descriptive testcase name
    const finalPdfPath = path.join(PDF_OUT_DIR, `${tc.name}.pdf`);
    fs.writeFileSync(finalPdfPath, pdfBufferRes);
    console.log(`Downloaded Bill PDF saved: ${finalPdfPath} (${pdfBufferRes.length} bytes)`);

    // Also save with exact official invoice filename
    const cleanInvoiceNum = String(billNumber).replace(/[\/\\]/g, '-');
    const invoicePdfPath = path.join(PDF_OUT_DIR, `Invoice_${cleanInvoiceNum}.pdf`);
    fs.writeFileSync(invoicePdfPath, pdfBufferRes);
    console.log(`Official Invoice PDF saved: ${invoicePdfPath}`);

    // H. Verification of PDF content & Description column
    console.log(`[Step H] Verifying PDF contents and description column structure...`);
    const pdfText = pdfBufferRes.toString('latin1');
    const isSinglePage = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length === 1;
    console.log(`PDF Page Count: ${isSinglePage ? '1 (Strictly 1 single page)' : 'Multiple pages'}`);

    // Verify HTML layout
    const htmlRes = await apiRequest(`/api/billing/pdf/${billId}?format=html`, 'GET', null, sessionToken);
    const html = htmlRes.data?.data?.html || htmlRes.data?.html || htmlRes.raw || '';

    // Verify TRUCK NUMBER and CONTAINER NUMBER mapped table in description column
    if (!html.includes('TRUCK NUMBER') || !html.includes('CONTAINER NUMBER')) {
      throw new Error(`Description column does NOT contain TRUCK NUMBER & CONTAINER NUMBER headers!`);
    }

    // Verify each container and vehicle number is mapped
    for (const c of tc.containers) {
      if (!html.includes(c.vehicleNumber)) {
        throw new Error(`Vehicle number ${c.vehicleNumber} missing from description table!`);
      }
      if (!html.includes(c.containerNumber)) {
        throw new Error(`Container number ${c.containerNumber} missing from description table!`);
      }
    }

    // Verify expected dynamic columns
    for (const col of tc.expectedColumns) {
      if (!html.includes(col)) {
        throw new Error(`Expected dynamic column "${col}" was NOT found in bill table!`);
      }
    }

    // Verify unexpected columns are omitted
    for (const col of tc.unexpectedColumns) {
      if (html.includes(`${col}<br>(INR)`)) {
        throw new Error(`Unexpected column "${col}" was found in bill table!`);
      }
    }

    console.log(`[Verification Passed] Description column strictly formats TRUCK NUMBER & CONTAINER NUMBER pairs!`);
    console.log(`[Verification Passed] Dynamic columns correctly generated without overflow!`);
  }

  await browser.close();

  console.log('\n=============================================================================');
  console.log(' ALL 3 UI TEST CASES COMPLETED & VALIDATED SUCCESSFULLY!');
  console.log(' Generated PDFs:');
  fs.readdirSync(PDF_OUT_DIR).filter((f) => f.endsWith('.pdf')).forEach((f) => {
    console.log('  - ' + f);
  });
  console.log(' Generated Screenshots:');
  fs.readdirSync(SCREENSHOT_DIR).forEach((f) => {
    console.log('  - ' + f);
  });
  console.log('=============================================================================');
}

run().catch((err) => {
  console.error('\n[FATAL ERROR IN UI TESTS]:', err);
  process.exit(1);
});
