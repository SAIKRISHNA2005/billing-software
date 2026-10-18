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

  // Discover all unique custom charge names across all charge rows
  const rawCharges = data.charges || [];
  const customChargeNames: string[] = [];
  rawCharges.forEach(r => {
    if (Array.isArray(r.customCharges)) {
      r.customCharges.forEach(cc => {
        if (cc && cc.name && String(cc.name).trim() && Number(cc.amount) > 0) {
          const trimmed = String(cc.name).trim();
          const exists = customChargeNames.some(existing => existing.toLowerCase() === trimmed.toLowerCase());
          if (!exists) {
            customChargeNames.push(trimmed);
          }
        }
      });
    }
  });

  // Identify which standard columns have non-zero charges for this bill
  const hasFreight = rawCharges.some(r => (Number(r.freightCharges) || 0) > 0 || !!r.freightFormula) || ((data.totals?.freightTotal || 0) > 0);
  const hasOther = rawCharges.some(r => (Number(r.otherCharges) || 0) > 0 || !!r.otherFormula) || ((data.totals?.otherChargesTotal || 0) > 0);
  const hasHalting = rawCharges.some(r => (Number(r.haltingCharges) || 0) > 0 || !!r.haltingFormula) || ((data.totals?.haltingTotal || 0) > 0);
  const hasAdvance = rawCharges.some(r => (Number(r.advance) || 0) > 0) || ((data.totals?.advanceTotal || 0) > 0);

  interface DynamicCol {
    key: string;
    label: string;
    width?: string;
    getValue: (row: any) => string;
    getTotal: () => number;
  }

  const dynamicCols: DynamicCol[] = [];

  // 1. Freight column: show if active, or as fallback if no charge columns exist
  if (hasFreight || (!hasOther && !hasHalting && !hasAdvance && customChargeNames.length === 0)) {
    dynamicCols.push({
      key: 'freight',
      label: 'Freight Charges<br>(INR)',
      getValue: (r) => r.freightFormula ? r.freightFormula : formatAmount(r.freightCharges),
      getTotal: () => data.totals?.freightTotal || 0,
    });
  }

  // 2. Halting column (if active)
  if (hasHalting) {
    dynamicCols.push({
      key: 'halting',
      label: 'Halting Charges<br>(INR)',
      getValue: (r) => r.haltingFormula ? r.haltingFormula : formatAmount(r.haltingCharges),
      getTotal: () => data.totals?.haltingTotal || 0,
    });
  }

  // 3. Other charges column (if active)
  if (hasOther) {
    dynamicCols.push({
      key: 'other',
      label: 'Other Charges<br>(INR)',
      getValue: (r) => r.otherFormula ? r.otherFormula : formatAmount(r.otherCharges),
      getTotal: () => data.totals?.otherChargesTotal || 0,
    });
  }

  // 4. Dynamic Custom Charge columns
  customChargeNames.forEach(colName => {
    const cleanHeader = colName.replace(/\s*\(inr\)$/i, '').trim();
    dynamicCols.push({
      key: `custom_${cleanHeader.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label: `${cleanHeader}<br>(INR)`,
      getValue: (r) => {
        const match = r.customCharges?.find((c: any) => c && c.name && String(c.name).trim().toLowerCase() === colName.toLowerCase());
        return match && Number(match.amount) > 0 ? formatAmount(match.amount) : '-';
      },
      getTotal: () => {
        return rawCharges.reduce((sum, r) => {
          const match = r.customCharges?.find((c: any) => c && c.name && String(c.name).trim().toLowerCase() === colName.toLowerCase());
          return sum + (match ? (Number(match.amount) || 0) : 0);
        }, 0);
      },
    });
  });

  // 5. Advance column (if active) - shown as deduction
  if (hasAdvance) {
    dynamicCols.push({
      key: 'advance',
      label: 'Advance Paid<br>(Deduction)',
      getValue: (r) => {
        const advVal = Number(r.advance) || 0;
        return advVal > 0 ? `- ${formatAmount(advVal)}` : '-';
      },
      getTotal: () => data.totals?.advanceTotal || 0,
    });
  }

  const numDynamicCols = dynamicCols.length;

  // Determine dynamic column sizing and typography based on total column density to strictly prevent overflow
  let sNoWidth = '5%';
  let amountWidth = '14%';
  let descWidth = '33%';
  let thFontSize = '10.5px';
  let tdFontSize = '10.5px';
  let tfootFontSize = '10.5px';
  let tfootTotalFontSize = '11.5px';
  let thPadding = '5px 4px';
  let tdPadding = '5px 4.5px';
  let descPadding = '5.5px 7px';
  let cellWhiteSpace = 'nowrap';

  if (numDynamicCols >= 6) {
    sNoWidth = '4%';
    amountWidth = '11%';
    descWidth = '23%';
    thFontSize = '8.5px';
    tdFontSize = '9px';
    tfootFontSize = '9px';
    tfootTotalFontSize = '10px';
    thPadding = '3px 2px';
    tdPadding = '4px 2px';
    descPadding = '4px 4px';
    cellWhiteSpace = 'normal';
  } else if (numDynamicCols >= 4) {
    sNoWidth = '4.5%';
    amountWidth = '12.5%';
    descWidth = '28%';
    thFontSize = '9.5px';
    tdFontSize = '10px';
    tfootFontSize = '10px';
    tfootTotalFontSize = '11px';
    thPadding = '4px 3px';
    tdPadding = '4.5px 3.5px';
    descPadding = '4.5px 5px';
    cellWhiteSpace = 'normal';
  } else if (numDynamicCols <= 1) {
    sNoWidth = '5.5%';
    amountWidth = '16%';
    descWidth = '48.5%';
    thFontSize = '11px';
    tdFontSize = '11px';
    tfootFontSize = '11px';
    tfootTotalFontSize = '12px';
    thPadding = '5.5px 4px';
    tdPadding = '5.5px 6px';
    descPadding = '5.5px 7px';
    cellWhiteSpace = 'nowrap';
  }

  // Calculate proportional width for dynamic columns to guarantee exactly 100% total table width
  const sNoPctVal = parseFloat(sNoWidth);
  const amountPctVal = parseFloat(amountWidth);
  const descPctVal = parseFloat(descWidth);
  const remainingForDynamic = Math.max(20, 100 - sNoPctVal - amountPctVal - descPctVal);
  const colPercent = numDynamicCols > 0 ? (remainingForDynamic / numDynamicCols).toFixed(2) : '15';

  dynamicCols.forEach(col => {
    col.width = `${colPercent}%`;
  });

  const chargeRows = rawCharges.map((row, idx) => {
    const sNo = row.sNo !== undefined && row.sNo !== null ? row.sNo : idx + 1;
    const isSpecialText = sNo === null || sNo === undefined || String(sNo).trim() === '';
    const amountContent = formatAmount(row.amount);
    const isLast = idx === rawCharges.length - 1;
    const rowBottomBorder = isLast ? 'border-bottom: none !important;' : 'border-bottom: 1px solid #000;';

    // Strictly ensure the description column ONLY contains the mapped TRUCK NUMBER and CONTAINER NUMBER table
    let renderedDesc = row.descriptionHtml;
    if (!renderedDesc || !renderedDesc.includes('CONTAINER NUMBER')) {
      const tNums = data.truckNumbers || [];
      const cNums = data.containerNumbers || [];
      const maxLen = Math.max(tNums.length, cNums.length);
      if (maxLen > 0) {
        const pairs: { truck: string; container: string }[] = [];
        for (let i = 0; i < maxLen; i++) {
          pairs.push({
            truck: tNums[i] || tNums[0] || '-',
            container: cNums[i] || cNums[0] || '-',
          });
        }
        renderedDesc = `
          <table style="width: 100%; border: none; border-collapse: collapse; margin: 0; padding: 0;">
            <thead>
              <tr>
                <th style="border: none; text-align: left; padding: 0 14px 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">TRUCK NUMBER</th>
                <th style="border: none; text-align: left; padding: 0 0 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">CONTAINER NUMBER</th>
              </tr>
            </thead>
            <tbody>
              ${pairs.map((p) => `
                <tr>
                  <td style="border: none; text-align: left; padding: 2px 14px 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">${p.truck}</td>
                  <td style="border: none; text-align: left; padding: 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">${p.container}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `.trim();
      } else {
        const lines = (row.description || '').split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines[0].includes('TRUCK NUMBER')) {
          const dataRows = lines.slice(1);
          renderedDesc = `
            <table style="width: 100%; border: none; border-collapse: collapse; margin: 0; padding: 0;">
              <thead>
                <tr>
                  <th style="border: none; text-align: left; padding: 0 14px 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">TRUCK NUMBER</th>
                  <th style="border: none; text-align: left; padding: 0 0 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">CONTAINER NUMBER</th>
                </tr>
              </thead>
              <tbody>
                ${dataRows.map(dr => {
                  const parts = dr.split(/\t|\s{2,}/);
                  return `
                    <tr>
                      <td style="border: none; text-align: left; padding: 2px 14px 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">${parts[0] || '-'}</td>
                      <td style="border: none; text-align: left; padding: 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">${parts[1] || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `.trim();
        } else {
          renderedDesc = `
            <table style="width: 100%; border: none; border-collapse: collapse; margin: 0; padding: 0;">
              <thead>
                <tr>
                  <th style="border: none; text-align: left; padding: 0 14px 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">TRUCK NUMBER</th>
                  <th style="border: none; text-align: left; padding: 0 0 4px 0; font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.3px; white-space: nowrap;">CONTAINER NUMBER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: none; text-align: left; padding: 2px 14px 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">-</td>
                  <td style="border: none; text-align: left; padding: 2px 0; font-size: 11px; font-weight: 600; color: #111; white-space: nowrap;">-</td>
                </tr>
              </tbody>
            </table>
          `.trim();
        }
      }
    }

    return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: ${sNoWidth}; vertical-align: top; padding-top: 5px; ${rowBottomBorder}">${isSpecialText ? '' : sNo}</td>
        <td style="vertical-align: top; width: ${descWidth}; padding: ${descPadding}; word-break: break-word; ${rowBottomBorder}">
          ${renderedDesc}
        </td>
        ${dynamicCols.map(col => `
          <td style="text-align: right; width: ${col.width}; vertical-align: top; padding-top: 5px; font-size: ${tdFontSize}; white-space: ${cellWhiteSpace}; ${rowBottomBorder}">
            ${col.getValue(row)}
          </td>
        `).join('')}
        <td style="text-align: right; font-weight: bold; width: ${amountWidth}; vertical-align: top; padding-top: 5px; font-size: ${tdFontSize}; white-space: nowrap; ${rowBottomBorder}">${amountContent}</td>
      </tr>
    `;
  }).join('');

  // Dynamically calibrate spacer height based on actual rendered charge line counts, address height, and header
  const estimatedChargesHeight = rawCharges.reduce((acc, row) => {
    let numPairs = 1;
    if (row.descriptionHtml) {
      const tbodyMatch = row.descriptionHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      const trMatches = (tbodyMatch ? tbodyMatch[1] : row.descriptionHtml).match(/<tr\b/gi);
      numPairs = trMatches ? trMatches.length : 1;
    } else {
      numPairs = Math.max(1, (data.truckNumbers || []).length, (data.containerNumbers || []).length);
    }
    return acc + (24 + (numPairs * 19) + 8);
  }, 0);

  const clientAddrLines = (data.client?.address || '').split(/[\r\n]+/).filter(Boolean).length;
  const extraAddrHeight = Math.max(0, (clientAddrLines - 1) * 12);
  const headerHeight = data.assets?.headerImage ? 245 : 120;
  const headerWrapOffset = numDynamicCols >= 6 ? 28 : (numDynamicCols >= 4 ? 14 : 0);

  // A4 printable height with 1mm top and 3px bottom margin is ~1115px; non-table elements take ~350px + headerHeight
  // Target available spacer height keeps bill strictly inside 1 page with minimal space (~3mm) from bottom border to end of page
  const availableSpacer = 675 - headerHeight - extraAddrHeight - estimatedChargesHeight - headerWrapOffset;
  const spacerHeight = Math.max(0, Math.round(availableSpacer));

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

  // Helper to format client address tightly without empty line gaps
  const formatClientAddress = (addr?: string) => {
    if (!addr || !addr.trim()) return 'Address on file';
    return addr
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('<br>');
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${data.billNumber || data.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1mm 8mm 3px 8mm;
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
      max-width: 194mm;
      margin: 0 auto;
      padding-top: 0;
      margin-bottom: 0px;
    }
    .info-split-row,
    table.charges-table tr,
    .words-row,
    .bottom-section {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    /* FULL-WIDTH TOP STATIC HEADER (Hero Image / Fallback) */
    .top-header-section {
      width: 100%;
      border: none !important;
      background: #fff;
      position: relative;
      margin: 0;
      padding: 0;
      line-height: 0;
      font-size: 0;
    }
    .header-image-container {
      width: 100%;
      padding: 0;
      margin: 0;
      display: block;
      line-height: 0;
      font-size: 0;
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
      line-height: 1.35;
      font-size: 11.5px;
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

    /* BORDERED MAIN INVOICE CONTAINER (Starts immediately below header) */
    .invoice-box {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      border: 2px solid #000;
      background: #fff;
      margin-top: 0;
      overflow: hidden;
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
      padding: 6px 10px;
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
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      box-sizing: border-box !important;
      border: none;
    }
    table.charges-table thead th {
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: ${thPadding};
      font-size: ${thFontSize};
      font-weight: bold;
      text-align: center;
      background-color: #fff;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
      hyphens: auto;
      line-height: 1.15;
      box-sizing: border-box;
    }
    table.charges-table thead th:last-child {
      border-right: none;
    }
    table.charges-table tbody td {
      border-bottom: 1px solid #000;
      border-right: 1px solid #000;
      padding: ${tdPadding};
      font-size: ${tdFontSize};
      vertical-align: top;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
      line-height: 1.25;
    }
    table.charges-table tbody td:last-child {
      border-right: none;
    }
    table.charges-table tbody td table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    table.charges-table tbody td table th,
    table.charges-table tbody td table td {
      border: none !important;
      padding: 1px 3px 1px 0 !important;
      font-size: ${tdFontSize} !important;
      white-space: normal !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      line-height: 1.2 !important;
    }
    table.charges-table tfoot td {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: ${tdPadding};
      font-size: ${tfootFontSize};
      font-weight: bold;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-wrap: break-word;
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
      width: 58%;
      border-right: none !important;
      padding: 8px 12px 10px 12px;
      font-size: 11px;
    }
    .seal-sign-box {
      width: 42%;
      padding: 4px 10px;
      margin: 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
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
          <div style="font-weight: bold; margin: 0; padding: 0; font-size: 10.5px; line-height: 1.1;">To :</div>
          <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.2px; margin: 0; padding: 0; text-transform: uppercase; line-height: 1.1;">
            ${(data.client.name || 'CLIENT NAME').trim()}
          </div>
          <div style="line-height: 1.1; font-size: 10px; color: #111; margin: 0 0 2px 0; padding: 0;">
            ${formatClientAddress(data.client.address)}
          </div>
          <div style="font-size: 10px; line-height: 1.2; margin-bottom: 2px;">
            <div><span style="font-weight: bold;">GST NO :</span> ${data.client.gstin || '-'}</div>
            <div><span style="font-weight: bold;">PAN NO :</span> ${data.client.pan || '-'}</div>
          </div>
          <div style="margin-top: 1px;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">Container From & To :</div>
            <div class="route-box" style="margin: 0; text-align: left; padding: 1.5px 5px; font-size: 10px;">
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

      <!-- 3. MAIN CHARGES TABLE (Dynamic columns as per active charges) -->
      <table class="charges-table">
        <colgroup>
          <col style="width: ${sNoWidth};">
          <col style="width: ${descWidth};">
          ${dynamicCols.map(col => `<col style="width: ${col.width};">`).join('')}
          <col style="width: ${amountWidth};">
        </colgroup>
        <thead>
          <tr>
            <th style="width: ${sNoWidth};">S.No.</th>
            <th style="width: ${descWidth};">Description</th>
            ${dynamicCols.map(col => `<th style="width: ${col.width}; text-align: right;">${col.label}</th>`).join('')}
            <th style="width: ${amountWidth}; text-align: right;">Amount<br>(INR)</th>
          </tr>
        </thead>
        <tbody>
          ${chargeRows}
          ${spacerHeight > 10 ? `
            <tr style="height: ${spacerHeight}px;">
              <td style="border-bottom: 1px solid #000;"></td>
              <td style="border-bottom: 1px solid #000;"></td>
              ${dynamicCols.map(() => '<td style="border-bottom: 1px solid #000;"></td>').join('')}
              <td style="border-bottom: 1px solid #000;"></td>
            </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 8px; font-size: ${tfootFontSize};">Total</td>
            ${dynamicCols.map(col => `
              <td style="text-align: right; font-weight: bold; font-size: ${tfootFontSize}; white-space: ${cellWhiteSpace};">
                ${col.key === 'advance' ? (col.getTotal() > 0 ? `- ${formatTotal(col.getTotal())}` : '-') : formatTotal(col.getTotal())}
              </td>
            `).join('')}
            <td style="text-align: right; font-weight: 800; font-size: ${tfootTotalFontSize}; white-space: nowrap;">${formatTotal(data.totals?.grandTotal ?? 0)}</td>
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
          <div style="height: 6px;"></div>
        </div>

        <!-- SEAL & SIGNATURE (Bottom Right) -->
        <div class="seal-sign-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3px 6px; min-height: 105px;">
          <!-- Top: Company Name in BOLD with minimal space below -->
          <div style="font-weight: 800; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.2px; color: #000; margin: 0 0 1px 0; line-height: 1.1;">
            FOR SRI PONNIAMMAN TRANS
          </div>

          <!-- Middle: Sign on LEFT, Seal on RIGHT with tight spacing matching physical Sri Ponniamman stamp reference -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 0px; margin: 1px 0;">
            ${data.assets?.signatureImage ? `
              <img
                src="${data.assets.signatureImage}"
                alt="Authorized Signature"
                style="width: 140px; height: 85px; object-fit: contain; z-index: 2;"
              />
            ` : ''}
            ${data.assets?.sealImage ? `
              <img
                src="${data.assets.sealImage}"
                alt="Official Seal"
                style="width: 98px; height: 98px; object-fit: contain; opacity: 0.92; z-index: 1; ${data.assets?.signatureImage ? 'margin-left: -22px;' : ''}"
              />
            ` : ''}
            ${(!data.assets?.sealImage && !data.assets?.signatureImage && data.assets?.sealAndSignatureImage) ? `
              <img
                src="${data.assets.sealAndSignatureImage}"
                alt="Seal & Signature"
                style="max-width: 220px; max-height: 95px; object-fit: contain;"
              />
            ` : ''}
          </div>

          <!-- Bottom: Authorised Signatory in BOLD with minimal space above -->
          <div style="font-weight: 800; font-size: 11px; color: #000; letter-spacing: 0.2px; margin: 1px 0 0 0; line-height: 1.1;">
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
