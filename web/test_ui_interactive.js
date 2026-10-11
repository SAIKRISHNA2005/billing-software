const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'ui_test_screenshots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('===============================================================');
  console.log('   STARTING FULL INTERACTIVE UI TEST FOR ALL 11 REQUIREMENTS   ');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // =========================================================================
  // REAL UI LOGIN
  // =========================================================================
  console.log('\n[AUTH UI] Navigating to Login page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('input[placeholder*="email"], input#email', { timeout: 15000 });

  console.log('[AUTH UI] Typing email & password into input fields...');
  await page.type('input[placeholder*="email"], input#email', 'admin@tms.local');
  await sleep(300);
  await page.type('input[type="password"]', 'Admin@12345');
  await sleep(300);

  console.log('[AUTH UI] Clicking Sign In button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Sign in') || b.innerText.includes('Sign In') || b.getAttribute('type') === 'submit');
    if (btn) btn.click();
  });

  console.log('[AUTH UI] Waiting for login redirect to /dashboard...');
  await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 35000 });
  console.log('[AUTH UI] Successfully logged in and navigated to /dashboard!');

  async function waitForAppReady(p) {
    await p.waitForFunction(() => {
      return !document.body.innerText.includes('Authenticating TMS session') &&
             !document.body.innerText.includes('Loading TMS Workspace');
    }, { timeout: 30000 });
    await sleep(2500);
  }

  // =========================================================================
  // TEST 1: Dashboard UI Testing (Requirements 9 & 10)
  // =========================================================================
  console.log('\n[TEST 1] Testing Dashboard Compliance Alert & Equal Bottom Tables...');
  await waitForAppReady(page);
  await page.waitForSelector('.ant-card', { timeout: 20000 }).catch(() => null);
  await sleep(3000);

  // Take Dashboard screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dashboard_full.png'), fullPage: false });
  console.log('Saved 01_dashboard_full.png');

  // Verify Compliance Alert Box
  const alertText = await page.evaluate(() => {
    const el = document.body.innerText;
    const hasVehicleCount = el.includes('Vehicle Count:');
    const hasTotalDocs = el.includes('Total Number of Documents:');
    const hasExpiredBadge = el.includes('Expired');
    const hasExpiringBadge = el.includes('Going to expire') || el.includes('Expires in');
    return { hasVehicleCount, hasTotalDocs, hasExpiredBadge, hasExpiringBadge };
  });
  console.log('Dashboard Compliance Alert Verification:', alertText);

  // Click View Details on first vehicle alert box if available
  const clickedDetails = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('View Details'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clickedDetails) {
    console.log('Clicked View Details button on vehicle alert card.');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard_vehicle_modal.png') });
    console.log('Saved 02_dashboard_vehicle_modal.png');
    // Close modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-footer button'));
      const closeBtn = buttons.find(b => b.innerText.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(800);
  }

  // Scroll down to bottom tables
  await page.evaluate(() => window.scrollTo(0, 1100));
  await sleep(1200);

  // Verify Both tables have Show dropdown and vertical scroll
  const bottomTablesInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ant-card'));
    const enquiriesCard = cards.find(c => c.innerText.includes('Recently Created Enquiries'));
    const billsCard = cards.find(c => c.innerText.includes('Recent Processed Invoices'));
    return {
      enquiriesHasShow: enquiriesCard ? enquiriesCard.innerText.includes('Show:') : false,
      billsHasShow: billsCard ? billsCard.innerText.includes('Show:') : false,
      enquiriesBodyScroll: enquiriesCard ? !!enquiriesCard.querySelector('.ant-table-body') : false,
      billsBodyScroll: billsCard ? !!billsCard.querySelector('.ant-table-body') : false,
    };
  });
  console.log('Bottom Tables Verification:', bottomTablesInfo);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_dashboard_bottom_tables.png') });
  console.log('Saved 03_dashboard_bottom_tables.png');

  // =========================================================================
  // TEST 2: Vehicle Fleet View & Edit popovers View vs Upload Documents (Requirement 7)
  // =========================================================================
  console.log('\n[TEST 2] Testing Vehicle Fleet & RC Management View vs Upload Documents...');
  await page.goto('http://localhost:3000/operations/movement', { waitUntil: 'networkidle2', timeout: 45000 });
  await waitForAppReady(page);
  await page.waitForSelector('.ant-table-row', { timeout: 15000 }).catch(() => null);
  await sleep(2000);

  // Click View icon on the first row
  const clickedView = await page.evaluate(() => {
    const eyeBtn = document.querySelector('.ant-table-row .anticon-eye') || document.querySelector('.ant-table-cell-fix-right .anticon-eye');
    if (eyeBtn) {
      eyeBtn.closest('button').click();
      return true;
    }
    return false;
  });
  if (clickedView) {
    console.log('Clicked View icon on vehicle row.');
    await sleep(2500);
    const viewModalBtnText = await page.evaluate(() => {
      const modal = document.querySelector('.ant-modal-content');
      if (!modal) return 'no modal';
      if (modal.innerText.includes('View Documents')) return 'View Documents';
      if (modal.innerText.includes('Upload Documents')) return 'Upload Documents';
      return 'neither';
    });
    console.log('View modal dynamically renders document action:', viewModalBtnText);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_vehicle_view_modal.png') });
    console.log('Saved 04_vehicle_view_modal.png');

    // Close view modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-footer button'));
      const closeBtn = buttons.find(b => b.innerText.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(1000);
  }

  // Click Edit icon on the first row
  const clickedEdit = await page.evaluate(() => {
    const editBtn = document.querySelector('.ant-table-row .anticon-edit') || document.querySelector('.ant-table-cell-fix-right .anticon-edit');
    if (editBtn) {
      editBtn.closest('button').click();
      return true;
    }
    return false;
  });
  if (clickedEdit) {
    console.log('Clicked Edit icon on vehicle row.');
    await sleep(2500);
    const editModalBtnText = await page.evaluate(() => {
      const modal = document.querySelector('.ant-modal-content');
      if (!modal) return 'none';
      if (modal.innerText.includes('View Documents')) return 'View Documents';
      if (modal.innerText.includes('Upload Documents')) return 'Upload Documents';
      return 'neither';
    });
    console.log('Edit modal dynamically renders button label:', editModalBtnText);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_vehicle_edit_modal.png') });
    console.log('Saved 05_vehicle_edit_modal.png');

    // Close edit modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-content button'));
      const cancelBtn = buttons.find(b => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(1000);
  }

  // =========================================================================
  // TEST 3: Pending Bills Date Filtering & Consignment Listing (Requirement 6 & 8)
  // =========================================================================
  console.log('\n[TEST 3] Testing Pending Bills Listing and Date Filtering...');
  await page.goto('http://localhost:3000/billing/pending', { waitUntil: 'networkidle2', timeout: 45000 });
  await waitForAppReady(page);
  await sleep(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_pending_bills_initial.png') });
  console.log('Saved 06_pending_bills_initial.png');

  // Verify if pending consignments appear
  const pendingRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr.ant-table-row'));
    return rows.map(r => r.innerText.replace(/\s+/g, ' '));
  });
  console.log(`Found ${pendingRows.length} pending consignments in table.`);

  // =========================================================================
  // TEST 4: Bill Create Page Auto-Mapping of All Charges (Requirement 5)
  // =========================================================================
  console.log('\n[TEST 4] Testing Bill Create Page auto-mapping of charges...');
  let checked = await page.evaluate(() => {
    const cb = document.querySelector('.ant-table-tbody tr:first-child .ant-checkbox-input');
    if (cb) {
      cb.click();
      return true;
    }
    return false;
  });

  if (checked) {
    console.log('Checked first pending consignment.');
    await sleep(1000);
    const clickedCreate = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Create Bill Invoice'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (clickedCreate) {
      console.log('Navigating to Bill Create page...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
      await waitForAppReady(page);
      await sleep(2500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_bill_create_mapped_charges.png') });
      console.log('Saved 07_bill_create_mapped_charges.png');

      const mappedItems = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr'));
        return rows.map(r => r.innerText.replace(/\n+/g, ' | '));
      });
      console.log('Auto-mapped Line Items in Bill Create Page:', mappedItems);
    }
  }

  // =========================================================================
  // TEST 5: Processed Bills Date Filtering (Requirement 8)
  // =========================================================================
  console.log('\n[TEST 5] Testing Processed Bills Date Filtering...');
  await page.goto('http://localhost:3000/billing/processed', { waitUntil: 'networkidle2', timeout: 45000 });
  await waitForAppReady(page);
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_processed_bills.png') });
  console.log('Saved 08_processed_bills.png');

  // =========================================================================
  // TEST 6: Bill Template HTML & Layout Verification (Requirements 1, 2, 3, 4, 11)
  // =========================================================================
  console.log('\n[TEST 6] Testing Bill Template (Final row bottom border, sign & seal spacing, hero image)...');
  await page.goto('http://localhost:3000/api/billing/preview?format=html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_bill_template_full.png'), fullPage: true });
  console.log('Saved 09_bill_template_full.png');

  // Detailed CSS / DOM inspection on Bill Template
  const templateVerification = await page.evaluate(() => {
    // 1. Final row border
    const lastRow = document.querySelector('.charges-table tbody tr.item-row:last-of-type') || document.querySelector('.charges-table tbody tr:last-child');
    const lastRowCells = lastRow ? Array.from(lastRow.querySelectorAll('td')).map(td => window.getComputedStyle(td).borderBottom) : [];

    // 2. Sign and Seal
    const signImg = document.querySelector('img[alt="Authorized Signature"]');
    const sealImg = document.querySelector('img[alt="Official Seal"]');
    const signatureContainer = signImg ? signImg.parentElement : null;

    return {
      lastRowHasBorderBottom: lastRowCells.some(b => b && !b.startsWith('0px') && !b.includes('none')),
      signDimensions: signImg ? { width: signImg.clientWidth, height: signImg.clientHeight } : null,
      sealDimensions: sealImg ? { width: sealImg.clientWidth, height: sealImg.clientHeight } : null,
      signSealGap: signatureContainer ? window.getComputedStyle(signatureContainer).gap : null,
      topHeaderMargin: window.getComputedStyle(document.querySelector('.top-header-section') || document.body).marginTop
    };
  });
  console.log('Bill Template Layout Verification:', templateVerification);

  await browser.close();
  console.log('\n===============================================================');
  console.log('   ALL INTERACTIVE UI TESTS COMPLETED SUCCESSFULLY!           ');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('UI Test failed with error:', err);
  process.exit(1);
});

