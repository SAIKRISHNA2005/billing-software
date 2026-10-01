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

  // Render dynamic charge rows strictly for content present (no empty filler rows)
  const rawCharges = data.charges || [];
  const chargeRows = rawCharges.map((row, idx) => {
    const sNo = row.sNo !== undefined && row.sNo !== null ? row.sNo : idx + 1;
    const isSpecialText = sNo === null || sNo === undefined || String(sNo).trim() === '';

    const freightContent = row.freightFormula ? row.freightFormula : formatAmount(row.freightCharges);
    const otherContent = row.otherFormula ? row.otherFormula : formatAmount(row.otherCharges);
    const haltingContent = row.haltingFormula ? row.haltingFormula : formatAmount(row.haltingCharges);
    const advanceContent = formatAmount(row.advance);
    const amountContent = formatAmount(row.amount);

    return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 44px; vertical-align: top; padding-top: 5px;">${isSpecialText ? '' : sNo}</td>
        <td style="vertical-align: top; padding: 5.5px 7px; word-break: break-word;">
          ${row.descriptionHtml ? row.descriptionHtml : `<div style="font-weight: 600; font-size: 11px; white-space: pre-line;">${row.description || '-'}</div>`}
        </td>
        <td style="text-align: right; width: 125px; vertical-align: top; padding-top: 5px; font-weight: 600; font-size: 11px; white-space: nowrap;">${freightContent}</td>
        <td style="text-align: right; width: 85px; vertical-align: top; padding-top: 5px; font-size: 11px; white-space: nowrap;">${otherContent}</td>
        <td style="text-align: right; width: 100px; vertical-align: top; padding-top: 5px; font-size: 11px; white-space: nowrap;">${haltingContent}</td>
        <td style="text-align: right; width: 85px; vertical-align: top; padding-top: 5px; font-size: 11px; white-space: nowrap;">${advanceContent}</td>
        <td style="text-align: right; font-weight: bold; width: 100px; vertical-align: top; padding-top: 5px; font-size: 11.5px; white-space: nowrap;">${amountContent}</td>
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
      margin: 3mm 10mm 6mm 10mm;
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
      font-size: 11.5px;
      line-height: 1.35;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 192mm;
      margin: 0 auto;
      padding-top: 0;
    }
    /* FULL-WIDTH TOP STATIC HEADER */
    .top-header-full {
      width: 100%;
      padding: 0 0 2px 0;
      position: relative;
      text-align: center;
    }
    .header-image-container {
      width: 100%;
      text-align: center;
      margin: 0 0 2px 0;
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
      margin-bottom: 2px;
    }
    .brand-address {
      font-size: 10.5px;
      text-align: center;
      line-height: 1.35;
      color: #111;
    }
    .icon-vinayagar {
      position: absolute;
      left: 6px;
      top: 4px;
      width: 60px;
      height: 70px;
      text-align: center;
    }
    .icon-truck {
      position: absolute;
      right: 6px;
      top: 6px;
      width: 85px;
      height: 65px;
      text-align: center;
    }

    /* TOP HEADER: NO BORDER FOR HEADER.PNG */
    .top-header-section {
      width: 100%;
      border: none !important;
      background: #fff;
      position: relative;
      margin-top: 0;
      margin-bottom: 2px;
      padding-top: 0;
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
      padding: 5px 10px 3px 10px;
      position: relative;
      text-align: center;
      border: none !important;
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
      margin-bottom: 2px;
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
      font-size: 11px;
      display: flex;
      flex-direction: column;
    }
    .info-right-details {
      width: 50%;
      padding: 8px 12px;
      font-size: 11px;
    }
    .detail-line {
      display: flex;
      margin-bottom: 3px;
      align-items: flex-start;
      font-size: 11px;
    }
    .detail-label {
      width: 95px;
      font-weight: bold;
      flex-shrink: 0;
      font-size: 11px;
    }
    .route-box {
      border: 1px solid #000;
      padding: 3px 6px;
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      margin: 3px 0 4px 0;
      text-transform: uppercase;
      background: #fafafa;
    }
    .truck-type-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 3px;
      font-size: 11px;
    }
    .count-box {
      border: 1px solid #000;
      display: inline-block;
      min-width: 22px;
      padding: 1px 5px;
      text-align: center;
      font-weight: bold;
      font-size: 11px;
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
      padding: 5.5px 4px;
      font-size: 11px;
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
      padding: 5.5px 6px;
      font-size: 11px;
      vertical-align: top;
    }
    table.charges-table tbody td:last-child {
      border-right: none;
    }
    table.charges-table tfoot td {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: 5.5px 6px;
      font-size: 11.5px;
      font-weight: bold;
    }
    table.charges-table tfoot td:last-child {
      border-right: none;
    }

    /* SECTION 4: WORDS ROW */
    .words-row {
      border-bottom: 1.5px solid #000;
      padding: 6px 12px;
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
      width: 60%;
      border-right: none !important;
      padding: 10px 14px 55px 14px;
      font-size: 11px;
      min-height: 155px;
    }
    .seal-sign-box {
      width: 40%;
      padding: 10px 14px 20px 14px;
      margin: 0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 155px;
      overflow: hidden;
    }
    .seal-sign-img-wrap {
      width: 100%;
      height: 100%;
      min-height: 125px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
    }
    .seal-sign-img-wrap img {
      width: 100%;
      max-width: 100%;
      height: auto;
      max-height: 125px;
      object-fit: contain;
      display: block;
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
        <!-- LEFT: TO SECTION WITH CLIENT GST, PAN & CONTAINER ROUTE -->
        <div class="info-left-to">
          <div style="font-weight: bold; margin-bottom: 1px; font-size: 11px;">To :</div>
          <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.2px; margin-bottom: 2px; text-transform: uppercase;">
            ${data.client.name || 'CLIENT NAME'}
          </div>
          <div style="white-space: pre-line; line-height: 1.25; font-size: 10.5px; color: #111; margin-bottom: 4px;">
            ${data.client.address || 'Address on file'}
          </div>
          <div style="font-size: 10.5px; line-height: 1.35; margin-bottom: 4px;">
            <div><span style="font-weight: bold;">GST NO :</span> ${data.client.gstin || '-'}</div>
            <div><span style="font-weight: bold;">PAN NO :</span> ${data.client.pan || '-'}</div>
          </div>
          <div style="margin-top: 2px;">
            <div style="font-weight: bold; font-size: 10.5px; margin-bottom: 2px;">Container From & To :</div>
            <div class="route-box" style="margin: 0; text-align: left; padding: 2px 6px;">
              ${data.routeText || (data.containerFrom && data.containerTo ? `${data.containerFrom} TO ${data.containerTo}` : 'LOCAL TRANSPORT')}
            </div>
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
          <div class="detail-line" style="margin-top: 4px;">
            <div class="detail-label">Load Type :</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${loadTypes.map(lt => renderCheckbox(lt.label, lt.key)).join('')}
            </div>
          </div>

          <div class="truck-type-row" style="margin-top: 10px;">
            <span style="font-weight: bold;">Truck Type :</span>
            <span>
              <span class="count-box">${data.truckCount20 || 0}</span>
              <span style="font-weight: bold; margin-left: 3px;">X 20 FEET</span>
            </span>
            <span>
              <span class="count-box">${data.truckCount40 || 0}</span>
              <span style="font-weight: bold; margin-left: 3px;">X 40 FEET</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 3. MAIN CHARGES TABLE (Dynamic rows only, no filler rows, no Rate column) -->
      <table class="charges-table">
        <thead>
          <tr>
            <th style="width: 44px;">S.No.</th>
            <th>Description</th>
            <th style="width: 125px;">Freight Charges<br>(INR)</th>
            <th style="width: 85px;">Other Charges<br>(INR)</th>
            <th style="width: 100px;">Halting Charges<br>(INR)</th>
            <th style="width: 85px;">Advance<br>(INR)</th>
            <th style="width: 100px;">Amount<br>(INR)</th>
          </tr>
        </thead>
        <tbody>
          ${chargeRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 12px;">Total</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">${formatTotal(data.totals.freightTotal)}</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">${formatTotal(data.totals.otherChargesTotal)}</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">${formatTotal(data.totals.haltingTotal)}</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">${formatTotal(data.totals.advanceTotal)}</td>
            <td style="text-align: right; font-weight: 800; font-size: 12.5px; white-space: nowrap;">${formatTotal(data.totals.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 4. TOTAL IN WORDS -->
      <div class="words-row">
        Total Rupees in words : <span style="font-weight: normal; margin-left: 6px;">${data.totalInWords || 'Zero Rupees Only'}</span>
      </div>

      <!-- 5. BOTTOM SECTION: GST/BANK DETAILS & SEAL/SIGNATURE -->
      <div class="bottom-section">
        <!-- GST & BANK DETAILS (Bottom Left) -->
        <div class="gst-pan-box">
          <div style="font-weight: bold; font-size: 11.5px; margin-bottom: 5px; text-transform: uppercase;">GST & Bank Details</div>
          <div style="display: grid; grid-template-columns: 85px auto; row-gap: 2.5px; font-size: 11px;">
            <div style="font-weight: bold;">GST NO</div>
            <div>: ${data.company.gstin || '33ASLPD2964M1ZH'}</div>
            <div style="font-weight: bold;">PAN NO</div>
            <div>: ${data.company.pan || 'ASLPD2964M'}</div>
            <div style="font-weight: bold;">BANK NAME</div>
            <div>: ${data.company.bankName || 'HDFC BANK'}</div>
            <div style="font-weight: bold;">A/C NO</div>
            <div>: ${data.company.accountNo || '50200012345678'}</div>
            <div style="font-weight: bold;">IFSC CODE</div>
            <div>: ${data.company.ifscCode || 'HDFC0001234'}</div>
            <div style="font-weight: bold;">BRANCH</div>
            <div>: ${data.company.branch || 'PARRYS, CHENNAI'}</div>
          </div>
          <!-- Generous empty space below GST & Bank details inside box -->
          <div style="height: 25px;"></div>
        </div>

        <!-- SEAL & SIGNATURE (Bottom Right) -->
        <div class="seal-sign-box">
          ${(data.assets?.sealAndSignatureImage || data.assets?.sealImage) ? `
            <div class="seal-sign-img-wrap">
              <img src="${data.assets.sealAndSignatureImage || data.assets.sealImage}" alt="Seal & Signature" />
            </div>
          ` : `
            <div class="seal-placeholder-frame" style="width: 90%; height: 90px; margin: 0 auto; display: flex; align-items: center; justify-content: center; border: 1px dashed #999;">
              [ Seal & Signature ]
            </div>
          `}
        </div>
      </div>

    </div>

  </div>
</body>
</html>
`;
}
