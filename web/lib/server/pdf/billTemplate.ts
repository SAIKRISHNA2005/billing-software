import { BillData } from './types';

/**
 * Format currency with 2 decimals and Indian grouping
 */
function formatAmount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '-';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTotal(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '-';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generate A4 HTML invoice matching Sri Ponniamman Trans visual reference
 */
export function generateBillHtml(data: BillData): string {
  const currentLoadType = (data.loadType || 'Export').toUpperCase();

  const loadTypes = [
    { label: 'Import', key: 'IMPORT' },
    { label: 'Export', key: 'EXPORT' },
    { label: 'Empty', key: 'EMPTY' },
    { label: 'Offload', key: 'OFFLOAD' },
    { label: 'Flatrack', key: 'FLATRACK' },
  ];

  // Render dynamic charge rows and pad with empty rows for uniform authentic invoice height
  const rawCharges = data.charges || [];
  const minRows = 10;
  const chargeRows = rawCharges.map((row, idx) => {
    const sNo = row.sNo !== undefined ? row.sNo : idx + 1;
    const isSpecialText = sNo === null || sNo === undefined || String(sNo).trim() === '';

    return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 44px; height: 25px;">${isSpecialText ? '' : sNo}</td>
        <td style="font-weight: 500; white-space: pre-line; word-break: break-word;">${row.description || '-'}</td>
        <td style="text-align: right; width: 85px;">${formatAmount(row.freightCharges)}</td>
        <td style="text-align: right; width: 75px;">${formatAmount(row.otherCharges)}</td>
        <td style="text-align: right; width: 75px;">${formatAmount(row.haltingCharges)}</td>
        <td style="text-align: right; width: 75px;">${formatAmount(row.advance)}</td>
        <td style="text-align: right; width: 60px;">${formatAmount(row.rate)}</td>
        <td style="text-align: right; font-weight: 600; width: 95px;">${formatAmount(row.amount)}</td>
      </tr>
    `;
  }).join('');

  // Pad empty rows to match the reference image's uniform spacing
  const emptyRowsNeeded = Math.max(0, minRows - rawCharges.length);
  const emptyRowsHtml = Array.from({ length: emptyRowsNeeded }, (_, i) => {
    const rowNum = rawCharges.length + i + 1;
    return `
      <tr>
        <td style="text-align: center; height: 24px; color: #555;">${rowNum <= 6 ? rowNum : ''}</td>
        <td>&nbsp;</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: center;">-</td>
      </tr>
    `;
  }).join('');

  // Checkbox generation helper
  const renderCheckbox = (label: string, key: string) => {
    const isChecked = currentLoadType === key || currentLoadType.includes(key);
    return `
      <span style="margin-right: 12px; display: inline-flex; align-items: center; gap: 4px;">
        <span style="display: inline-block; width: 12px; height: 12px; border: 1.2px solid #000; text-align: center; line-height: 10px; font-size: 11px; font-weight: bold;">
          ${isChecked ? '&#10003;' : '&nbsp;'}
        </span>
        <span style="${isChecked ? 'font-weight: bold; text-decoration: underline;' : ''}">${label}</span>
      </span>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${data.billNumber || data.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.35;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 192mm;
      margin: 0 auto;
    }
    /* FULL-WIDTH TOP STATIC HEADER */
    .top-header-full {
      width: 100%;
      padding: 0 0 6px 0;
      position: relative;
      text-align: center;
    }
    .header-image-container {
      width: 100%;
      text-align: center;
      margin: 0 0 4px 0;
      padding: 0;
    }
    .header-image-container img {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000;
      margin: 2px 0 1px 0;
      text-align: center;
      font-family: "Arial Black", Arial, sans-serif;
    }
    .brand-subtitle {
      font-size: 13.5px;
      font-style: italic;
      font-weight: bold;
      text-align: center;
      margin-bottom: 3px;
    }
    .brand-address {
      font-size: 11px;
      text-align: center;
      line-height: 1.4;
      color: #111;
    }
    .icon-vinayagar {
      position: absolute;
      left: 6px;
      top: 4px;
      width: 65px;
      height: 75px;
      text-align: center;
    }
    .icon-truck {
      position: absolute;
      right: 6px;
      top: 6px;
      width: 90px;
      height: 70px;
      text-align: center;
    }

    /* TOP HEADER: NO BORDER FOR HEADER.PNG */
    .top-header-section {
      width: 100%;
      border: none !important;
      background: #fff;
      position: relative;
      margin-bottom: 6px;
    }
    .header-image-container {
      width: 100%;
      padding: 0;
      margin: 0;
      display: block;
      line-height: 0;
      border: none !important;
    }
    .header-image-container img {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      outline: none !important;
    }
    .header-fallback-container {
      padding: 6px 12px 4px 12px;
      position: relative;
      text-align: center;
      border: none !important;
    }
    .icon-vinayagar {
      position: absolute;
      left: 12px;
      top: 6px;
      width: 65px;
      height: 75px;
      text-align: center;
    }
    .icon-truck {
      position: absolute;
      right: 12px;
      top: 8px;
      width: 90px;
      height: 70px;
      text-align: center;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000;
      margin: 2px 0 1px 0;
      text-align: center;
      font-family: "Arial Black", Arial, sans-serif;
    }
    .brand-subtitle {
      font-size: 13px;
      font-style: italic;
      font-weight: bold;
      text-align: center;
      margin-bottom: 3px;
    }
    .brand-address {
      font-size: 10.5px;
      text-align: center;
      line-height: 1.35;
      color: #111;
    }

    /* BORDERED MAIN INVOICE CONTAINER (Starts below header) */
    .invoice-box {
      width: 100%;
      border: 2px solid #000;
      background: #fff;
    }

    /* SECTION 2: TOP 2-COLUMN SECTION */
    .info-split-row {
      display: flex;
      border-bottom: 1.5px solid #000;
      width: 100%;
    }
    .info-left-to {
      width: 50%;
      border-right: 1.5px solid #000;
      padding: 8px 12px;
      font-size: 11.5px;
      display: flex;
      flex-direction: column;
    }
    .info-right-details {
      width: 50%;
      padding: 8px 12px;
      font-size: 11.5px;
    }
    .detail-line {
      display: flex;
      margin-bottom: 3px;
      align-items: flex-start;
    }
    .detail-label {
      width: 95px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .route-box {
      border: 1px solid #000;
      padding: 3px 6px;
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      margin: 3px 0 5px 0;
      text-transform: uppercase;
      background: #fafafa;
    }
    .truck-type-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 3px;
    }
    .count-box {
      border: 1px solid #000;
      display: inline-block;
      min-width: 24px;
      padding: 1px 6px;
      text-align: center;
      font-weight: bold;
      background: #fff;
    }

    /* SECTION 3: CHARGES TABLE */
    table.charges-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    table.charges-table thead th {
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: 5px 4px;
      font-size: 10.5px;
      font-weight: bold;
      text-align: center;
      background-color: #fff;
    }
    table.charges-table thead th:last-child {
      border-right: none;
    }
    table.charges-table tbody td {
      border-bottom: 1px solid #000;
      border-right: 1px solid #000;
      padding: 3.5px 6px;
      font-size: 11px;
      vertical-align: middle;
    }
    table.charges-table tbody td:last-child {
      border-right: none;
    }
    table.charges-table tfoot td {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: 5px 6px;
      font-size: 11.5px;
      font-weight: bold;
    }
    table.charges-table tfoot td:last-child {
      border-right: none;
    }

    /* SECTION 4: WORDS ROW */
    .words-row {
      border-bottom: 1.5px solid #000;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: bold;
      background: #fff;
    }

    /* SECTION 5: BOTTOM FOOTER SECTION */
    .bottom-section {
      display: flex;
      width: 100%;
    }
    .gst-pan-box {
      width: 65%;
      border-right: 1.5px solid #000;
      padding: 8px 12px;
      font-size: 11.5px;
    }
    .seal-sign-box {
      width: 35%;
      padding: 8px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 80px;
    }
    .seal-placeholder-frame {
      border: 1px solid #000;
      height: 32px;
      width: 130px;
      margin: 2px auto 4px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #444;
      background: #fff;
    }
    .signatory-label {
      border-top: 1px dotted #000;
      margin-top: 10px;
      padding-top: 3px;
      font-size: 10.5px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    
    <!-- TOP HEADER: BORDERLESS FULL-WIDTH HEADER (No border around header image) -->
    <div class="top-header-section">
      ${data.assets?.headerImage ? `
        <div class="header-image-container">
          <img src="${data.assets.headerImage}" alt="Sri Ponniamman Trans Header" />
        </div>
      ` : `
        <div class="header-fallback-container">
          <!-- SVG Vinayagar icon left -->
          <div class="icon-vinayagar">
            <svg viewBox="0 0 60 70" width="52" height="62" fill="#222">
              <path d="M30 5 C24 5 20 10 20 16 C20 22 24 26 26 28 C22 30 15 36 15 45 C15 54 22 62 30 62 C38 62 45 54 45 45 C45 36 38 30 34 28 C36 26 40 22 40 16 C40 10 36 5 30 5 Z M30 12 C32 12 34 14 34 16 C34 18 32 20 30 20 C28 20 26 18 26 16 C26 14 28 12 30 12 Z M30 32 C35 32 39 36 39 42 C39 48 35 52 30 52 C25 52 21 48 21 42 C21 36 25 32 30 32 Z"/>
            </svg>
          </div>

          <!-- Center Typography -->
          <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 2px;">
            &#2933; Sri Vinayagar Thunai
          </div>
          <div class="brand-title">SRI PONNIAMMAN TRANS</div>
          <div class="brand-subtitle">Fleet Owners & Transport Contractors</div>
          <div class="brand-address">
            No. 12/1, Coral Merchant Street, Chennai - 600 001.<br>
            Tel: 42061100, Cell : 99417 80675, 97890 00802, 99414 01225<br>
            e-mail : dharmasriponniammantrans@gmail.com
          </div>

          <!-- SVG Truck icon right -->
          <div class="icon-truck">
            <svg viewBox="0 0 90 70" width="76" height="58" fill="#111">
              <rect x="5" y="15" width="50" height="35" rx="3" fill="#333"/>
              <text x="30" y="38" fill="#fff" font-size="14" font-weight="bold" text-anchor="middle" font-family="Arial">SPT</text>
              <path d="M55 25 L75 25 L82 40 L82 50 L55 50 Z" fill="#222"/>
              <circle cx="22" cy="52" r="8" fill="#000"/>
              <circle cx="22" cy="52" r="3" fill="#fff"/>
              <circle cx="40" cy="52" r="8" fill="#000"/>
              <circle cx="40" cy="52" r="3" fill="#fff"/>
              <circle cx="70" cy="52" r="8" fill="#000"/>
              <circle cx="70" cy="52" r="3" fill="#fff"/>
            </svg>
          </div>
        </div>
      `}
    </div>

    <!-- MAIN BORDERED INVOICE CONTAINER (Starts below header) -->
    <div class="invoice-box">

      <!-- 1. TOP 2-COLUMN SECTION -->
      <div class="info-split-row">
        <!-- LEFT: TO SECTION (STRICTLY NO GST/PAN) -->
        <div class="info-left-to">
          <div style="font-weight: bold; margin-bottom: 4px; font-size: 12.5px;">To :</div>
          <div style="font-size: 13.5px; font-weight: 900; letter-spacing: 0.3px; margin-bottom: 4px; text-transform: uppercase;">
            ${data.client.name || 'CLIENT NAME'}
          </div>
          <div style="white-space: pre-line; line-height: 1.4; color: #222;">
            ${data.client.address || 'Address on file'}
          </div>
        </div>

        <!-- RIGHT: BILL DETAILS SECTION -->
        <div class="info-right-details">
          <div class="detail-line">
            <div class="detail-label">Invoice No :</div>
            <div style="font-weight: bold; font-size: 12.5px;">${data.billNumber || data.id}</div>
          </div>
          <div class="detail-line">
            <div class="detail-label">Bill Date :</div>
            <div style="font-weight: bold;">${data.billDate || '-'}</div>
          </div>
          <div class="detail-line" style="margin-top: 3px;">
            <div class="detail-label">Load Type :</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${loadTypes.map(lt => renderCheckbox(lt.label, lt.key)).join('')}
            </div>
          </div>

          <div style="font-weight: bold; margin-top: 4px; font-size: 11px;">Container From & To :</div>
          <div class="route-box">
            ${data.routeText || (data.containerFrom && data.containerTo ? `${data.containerFrom} TO ${data.containerTo}` : 'LOCAL TRANSPORT')}
          </div>

          <div class="truck-type-row">
            <span style="font-weight: bold;">Truck Type :</span>
            <span>
              <span class="count-box">${data.truckCount20 || 0}</span>
              <span style="font-weight: bold; margin-left: 4px;">X 20 FEET</span>
            </span>
            <span>
              <span class="count-box">${data.truckCount40 || 0}</span>
              <span style="font-weight: bold; margin-left: 4px;">X 40 FEET</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 3. MAIN CHARGES TABLE -->
      <table class="charges-table">
        <thead>
          <tr>
            <th style="width: 44px;">S.No.</th>
            <th>Description</th>
            <th style="width: 85px;">Freight Charges<br>(INR)</th>
            <th style="width: 75px;">Other Charges<br>(INR)</th>
            <th style="width: 75px;">Halting Charges<br>(INR)</th>
            <th style="width: 75px;">Advance<br>(INR)</th>
            <th style="width: 60px;">Rate<br>(INR)</th>
            <th style="width: 95px;">Amount<br>(INR)</th>
          </tr>
        </thead>
        <tbody>
          ${chargeRows}
          ${emptyRowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 14px;">Total</td>
            <td style="text-align: right; font-weight: bold;">${formatTotal(data.totals.freightTotal)}</td>
            <td style="text-align: right; font-weight: bold;">${formatTotal(data.totals.otherChargesTotal)}</td>
            <td style="text-align: right; font-weight: bold;">${formatTotal(data.totals.haltingTotal)}</td>
            <td style="text-align: right; font-weight: bold;">${formatTotal(data.totals.advanceTotal)}</td>
            <td style="text-align: right;">-</td>
            <td style="text-align: right; font-weight: 800; font-size: 12px;">${formatTotal(data.totals.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 4. TOTAL IN WORDS -->
      <div class="words-row">
        Total Rupees in words : <span style="font-weight: normal; margin-left: 6px;">${data.totalInWords || 'Zero Rupees Only'}</span>
      </div>

      <!-- 5. BOTTOM SECTION: GST/PAN & SEAL/SIGNATURE -->
      <div class="bottom-section">
        <!-- GST & PAN (Bottom Left) -->
        <div class="gst-pan-box">
          <div style="font-weight: bold; font-size: 11.5px; margin-bottom: 4px;">GST Details</div>
          <div style="display: flex; margin-bottom: 2px;">
            <div style="width: 70px; font-weight: bold;">GST No</div>
            <div>: ${data.company.gstin || '33ASLPD2964M1ZH'}</div>
          </div>
          <div style="display: flex;">
            <div style="width: 70px; font-weight: bold;">PAN No</div>
            <div>: ${data.company.pan || 'ASLPD2964M'}</div>
          </div>
        </div>

        <!-- SEAL & AUTHORISED SIGNATORY (Bottom Right) -->
        <div class="seal-sign-box">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 2px;">Seal</div>
          ${data.assets?.sealImage ? `
            <div style="margin: 0 auto;">
              <img src="${data.assets.sealImage}" alt="Seal" style="max-height: 45px; max-width: 140px; object-fit: contain;" />
            </div>
          ` : `
            <div class="seal-placeholder-frame">
              [ Seal ]
            </div>
          `}
          <div class="signatory-label">
            ${data.assets?.signatureImage ? `
              <div style="margin-bottom: 2px;">
                <img src="${data.assets.signatureImage}" alt="Signature" style="max-height: 35px; max-width: 140px; object-fit: contain;" />
              </div>
            ` : ''}
            Authorised Signatory
          </div>
        </div>
      </div>

    </div>

  </div>
</body>
</html>
`;
}
