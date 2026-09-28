import fs from 'fs';
import path from 'path';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { numberToWordsINR } from '@/lib/utils/pdfHelper';
import { BillData, BillChargeItem } from './types';

interface RawBillItem {
  enquiryId?: string;
  description?: string;
  amount?: number;
  freightAmount?: number;
  haltingAmount?: number;
  advanceAmount?: number;
  otherCharges?: number;
  rate?: number;
}

interface RawEnquiry {
  id: string;
  enquiryNumber?: string | number;
  transactionNumber?: string;
  loadingType?: string;
  vehicleId?: string;
  vehicleNo?: string;
  vehicleNumber?: string;
  containerId?: string;
  containerNo?: string;
  containerNumber?: string;
  containerSize?: string;
  noOfContainers?: number;
  truckCount20?: number;
  truckCount40?: number;
  containerFrom?: string;
  containerTo?: string;
  sealNumber?: string;
  freightAmount?: number;
  haltingDays?: number;
  haltingAmount?: number;
  advanceAmount?: number;
  otherCharges?: number;
  clientAddress?: string;
  billId?: string;
  product?: string;
  cargo?: string;
}

/**
 * Helper to convert local image to base64 Data URL if it's a real user-uploaded image
 */
function getAssetDataUri(filename: string): string | undefined {
  try {
    const filePath = path.join(process.cwd(), 'public', 'assets', 'billing', filename);
    if (!fs.existsSync(filePath)) return undefined;
    const stats = fs.statSync(filePath);
    // Ignore placeholder 1x1 transparent PNGs (< 200 bytes)
    if (stats.size < 250) return undefined;
    const buffer = fs.readFileSync(filePath);
    const mime = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

/**
 * Format date from ISO or YYYY-MM-DD to DD-MM-YYYY
 */
function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().substring(0, 10).split('-').reverse().join('-');
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Maps raw bill and enquiry records from Excel / Backend into a clean BillData object
 */
export async function mapBillData(billIdentifier: string, sessionToken?: string | null): Promise<BillData> {
  if (!billIdentifier || !billIdentifier.trim()) {
    throw new Error('A valid bill identifier (ID or Bill Number) is required.');
  }

  const cleanIdentifier = billIdentifier.trim();
  let bill: any = null;

  // 1. Fetch bill via Apps Script or local fallback
  try {
    const res = await callAppsScript<any>('bill.get', { id: cleanIdentifier }, sessionToken);
    if (res.success && res.data) {
      bill = res.data;
    }
  } catch (err) {
    console.warn('[BillDataMapper] Apps Script bill.get failed, checking local store:', err);
  }

  // 1b. If not found by ID, attempt listing to match by billNumber
  if (!bill) {
    try {
      const listRes = await callAppsScript<any>('bill.list', { search: cleanIdentifier, limit: 10 }, sessionToken);
      if (listRes.success && listRes.data?.items) {
        bill = listRes.data.items.find(
          (b: any) => b.id === cleanIdentifier || b.billNumber === cleanIdentifier
        );
      }
    } catch {}
  }

  if (!bill) {
    throw new Error(`Bill or Invoice "${cleanIdentifier}" could not be found.`);
  }

  // 2. Fetch Linked Enquiries
  let linkedEnquiries: RawEnquiry[] = Array.isArray(bill.enquiries) ? bill.enquiries : [];

  if (linkedEnquiries.length === 0) {
    const enquiryIds: string[] = Array.isArray(bill.enquiryIds) ? bill.enquiryIds : [];
    try {
      const enqRes = await callAppsScript<any>('enquiry.list', { limit: 100 }, sessionToken);
      if (enqRes.success && enqRes.data?.items) {
        linkedEnquiries = enqRes.data.items.filter((e: any) =>
          e.billId === bill.id || enquiryIds.includes(e.id)
        );
      }
    } catch {}
  }

  // 3. Resolve Client Details (Ensure address is populated)
  let clientAddress = bill.clientAddress || bill.client?.address || '';
  const clientName = bill.clientName || bill.client?.name || 'SIA LOGISTICS GLOBAL';

  if (!clientAddress && bill.clientId) {
    try {
      const cltRes = await callAppsScript<any>('clients.get', { id: bill.clientId }, sessionToken);
      if (cltRes.success && cltRes.data?.address) {
        clientAddress = cltRes.data.address;
      }
    } catch {}
  }

  if (!clientAddress) {
    const firstEnqWithAddr = linkedEnquiries.find((e) => e.clientAddress);
    clientAddress = firstEnqWithAddr?.clientAddress || '#37/24, Narayana Sarang Garden Street,\n5th Floor, Seethakathi Centre,\nParrys, Chennai - 600 001.';
  }

  // 4b. Pre-fetch vehicle and container masters for ID resolution if necessary
  const vehicleMap = new Map<string, string>();
  const containerMap = new Map<string, string>();

  try {
    const vRes = await callAppsScript<any>('vehicles.list', { limit: 100 }, sessionToken);
    if (vRes.success && vRes.data?.items) {
      vRes.data.items.forEach((v: any) => {
        if (v.id && v.vehicleNumber) vehicleMap.set(v.id, v.vehicleNumber);
      });
    }
  } catch {}

  try {
    const cRes = await callAppsScript<any>('containers.list', { limit: 100 }, sessionToken);
    if (cRes.success && cRes.data?.items) {
      cRes.data.items.forEach((c: any) => {
        if (c.id && c.containerNumber) containerMap.set(c.id, c.containerNumber);
      });
    }
  } catch {}

  // 4c. Resolve Route & Container Sizes
  let loadType = 'Export';
  let containerFrom = 'ZIRCON';
  let containerTo = 'GODREJ AMBATTUR';
  let truckCount20 = 0;
  let truckCount40 = 0;
  const truckNumbersSet = new Set<string>();
  const containerNumbersSet = new Set<string>();

  linkedEnquiries.forEach((e) => {
    if (e.loadingType) loadType = e.loadingType;
    if (e.containerFrom) containerFrom = e.containerFrom;
    if (e.containerTo) containerTo = e.containerTo;

    // Vehicle numbers
    const vNo = e.vehicleNo || e.vehicleNumber || (e.vehicleId ? vehicleMap.get(e.vehicleId) : undefined);
    if (vNo && vNo !== '-') truckNumbersSet.add(vNo.trim());

    // Container numbers
    const cNo = e.containerNo || e.containerNumber || (e.containerId ? containerMap.get(e.containerId) : undefined);
    if (cNo && cNo !== '-') containerNumbersSet.add(cNo.trim());

    // 20 FT vs 40 FT counts
    const count20 = Number(e.truckCount20) || 0;
    const count40 = Number(e.truckCount40) || 0;

    if (count20 > 0 || count40 > 0) {
      truckCount20 += count20;
      truckCount40 += count40;
    } else {
      const sizeStr = (e.containerSize || '').toUpperCase();
      const num = Number(e.noOfContainers) || 1;
      if (sizeStr.includes('20')) {
        truckCount20 += num;
      } else {
        truckCount40 += num;
      }
    }
  });

  const truckNumbers = Array.from(truckNumbersSet);
  const containerNumbers = Array.from(containerNumbersSet);

  // Helper to format currency inside formulas
  const formatINR = (val: number) =>
    Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 5. Build Dynamic Charges Table
  const rawItems: RawBillItem[] = Array.isArray(bill.items) ? bill.items : [];
  const charges: BillChargeItem[] = [];

  let freightTotal = 0;
  let otherChargesTotal = 0;
  let haltingTotal = 0;
  let advanceTotal = 0;
  let grandTotal = 0;

  let currentSNo = 1;

  if (linkedEnquiries.length > 0) {
    linkedEnquiries.forEach((e) => {
      // 1. Vehicle number
      let vNum = e.vehicleNo || e.vehicleNumber || '';
      if (!vNum && e.vehicleId) {
        vNum = vehicleMap.get(e.vehicleId) || e.vehicleId;
      }

      // 2. Container number
      let cNum = e.containerNo || e.containerNumber || '';
      if (!cNum && e.containerId) {
        cNum = containerMap.get(e.containerId) || e.containerId;
      }
      if (!cNum) {
        const matchItem = rawItems.find((it) => it.enquiryId === e.id && it.description);
        if (matchItem?.description) {
          const match = matchItem.description.match(/([A-Z]{4}\d{6,7})/i);
          if (match) cNum = match[1];
        }
      }

      // 3. Count and size
      const count20 = Number(e.truckCount20) || 0;
      const count40 = Number(e.truckCount40) || 0;
      const explicitCount = count20 + count40;
      const count = explicitCount > 0 ? explicitCount : (Number(e.noOfContainers) || 1);

      let sizeDesc = (e.containerSize || '').trim();
      if (!sizeDesc) {
        if (count20 > 0 && count40 === 0) sizeDesc = '20 FT';
        else if (count40 > 0 && count20 === 0) sizeDesc = '40 FT';
        else if (count20 > 0 && count40 > 0) sizeDesc = `${count20}x20FT, ${count40}x40FT`;
        else sizeDesc = '40 FT';
      }

      // 4. Product / Service title
      const prodType = (e.loadingType || loadType || 'Export').toUpperCase();
      const productTitle = (e as any).product || (e as any).cargo || `${prodType} CONTAINER TRANSPORTATION (${sizeDesc})`;

      const countLabel = `${count} Container${count > 1 ? 's' : ''}${sizeDesc ? ` (${sizeDesc})` : ''}`;

      // 5. Freight formula: count X actual rate per count
      const freightAmt = Number(e.freightAmount) || 0;
      const unitRate = count > 0 && freightAmt > 0 ? Math.round(freightAmt / count) : freightAmt;

      // Build Compact, Professional Multi-Line Description HTML
      const descLines: string[] = [];
      const sealText = e.sealNumber && e.sealNumber !== '-' ? ` &nbsp;|&nbsp; <strong>Seal No:</strong> ${e.sealNumber}` : '';
      descLines.push(`<div><strong>Count:</strong> ${countLabel}${sealText}</div>`);

      const hasVehicle = Boolean(vNum && vNum !== '-');
      const hasContainer = Boolean(cNum && cNum !== '-');
      if (hasVehicle || hasContainer) {
        const vPart = hasVehicle ? `<strong>Vehicle No:</strong> ${vNum}` : '';
        const sep = (hasVehicle && hasContainer) ? ' &nbsp;|&nbsp; ' : '';
        const cPart = hasContainer ? `<strong>Container No:</strong> ${cNum}` : '';
        descLines.push(`<div>${vPart}${sep}${cPart}</div>`);
      }

      const enqRoute = (e.containerFrom && e.containerTo) ? `${e.containerFrom} TO ${e.containerTo}` : '';
      if (enqRoute) descLines.push(`<div><strong>Route:</strong> ${enqRoute}</div>`);

      const descriptionHtml = `
        <div style="font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #000; margin-bottom: 2px;">
          ${productTitle}
        </div>
        <div style="font-size: 11px; line-height: 1.35; color: #222;">
          ${descLines.join('')}
        </div>
      `.trim();

      const plainDescription = [
        productTitle,
        `Count: ${countLabel}`,
        vNum ? `Vehicle: ${vNum}` : null,
        cNum ? `Container: ${cNum}` : null,
        enqRoute ? `Route: ${enqRoute}` : null,
      ].filter(Boolean).join('\n');

      const freightFormula = freightAmt > 0 ? `${count} X ${formatINR(unitRate)}` : '-';

      // Halting Formula
      const haltingAmt = Number(e.haltingAmount) || 0;
      const haltingDays = Number(e.haltingDays) || 0;
      let haltingFormula: string | undefined = undefined;
      if (haltingAmt > 0) {
        if (haltingDays > 0) {
          const perDay = Math.round(haltingAmt / haltingDays);
          haltingFormula = `${haltingDays} Day${haltingDays > 1 ? 's' : ''} X ${formatINR(perDay)}`;
        } else {
          haltingFormula = formatINR(haltingAmt);
        }
      }

      const otherAmt = Number(e.otherCharges) || 0;
      const advAmt = Number(e.advanceAmount) || 0;
      const rowTotal = freightAmt + otherAmt + haltingAmt;

      charges.push({
        sNo: currentSNo++,
        description: plainDescription,
        descriptionHtml,
        freightFormula: freightAmt > 0 ? freightFormula : undefined,
        freightCharges: freightAmt > 0 ? freightAmt : null,
        otherCharges: otherAmt > 0 ? otherAmt : null,
        haltingFormula,
        haltingCharges: haltingAmt > 0 ? haltingAmt : null,
        advance: advAmt > 0 ? advAmt : null,
        rate: null,
        amount: rowTotal > 0 ? rowTotal : freightAmt,
      });

      freightTotal += freightAmt;
      otherChargesTotal += otherAmt;
      haltingTotal += haltingAmt;
      advanceTotal += advAmt;
      grandTotal += rowTotal;
    });

    // Check for any standalone bill items that weren't tied to an enquiry
    const linkedEnqIds = new Set(linkedEnquiries.map((e) => e.id));
    const standaloneItems = rawItems.filter((it) => it.enquiryId && !linkedEnqIds.has(it.enquiryId));
    standaloneItems.forEach((it) => {
      const amt = Number(it.amount) || 0;
      if (amt > 0) {
        charges.push({
          sNo: currentSNo++,
          description: it.description || 'Additional Charges',
          freightCharges: null,
          otherCharges: amt,
          haltingCharges: null,
          advance: null,
          rate: null,
          amount: amt,
        });
        otherChargesTotal += amt;
        grandTotal += amt;
      }
    });
  } else if (rawItems.length > 0) {
    // Non-enquiry items (e.g. manual items or test fixtures)
    rawItems.forEach((it) => {
      const amt = Number(it.amount) || 0;
      const desc = it.description || 'Freight Charges';
      const descLower = desc.toLowerCase();
      const isFreight = descLower.includes('freight') || descLower.includes('transport');
      const isOther = descLower.includes('other') || descLower.includes('additional') || descLower.includes('toll');
      const isHalting = descLower.includes('halting');
      const isAdv = descLower.includes('advance');

      const itemFreight = (isFreight || (!isOther && !isHalting && !isAdv)) ? amt : null;
      const itemOther = isOther ? amt : null;
      const itemHalting = isHalting ? amt : null;
      const itemAdv = isAdv ? amt : null;

      charges.push({
        sNo: currentSNo++,
        description: desc,
        freightCharges: itemFreight,
        otherCharges: itemOther,
        haltingCharges: itemHalting,
        advance: itemAdv,
        rate: null,
        amount: amt,
      });

      if (itemFreight) freightTotal += itemFreight;
      if (itemOther) otherChargesTotal += itemOther;
      if (itemHalting) haltingTotal += itemHalting;
      if (itemAdv) advanceTotal += itemAdv;
      grandTotal += amt;
    });
  } else {
    // Fallback single consignment row
    const totalCount = (truckCount20 + truckCount40) || 1;
    const freightAmt = Number(bill.subtotal || bill.totalAmount) || 0;
    const unitRate = totalCount > 0 ? Math.round(freightAmt / totalCount) : freightAmt;
    const sizeStr = (truckCount20 > 0 && truckCount40 === 0) ? '20 FT' : '40 FT';
    const prodTitle = `${loadType.toUpperCase()} CONTAINER TRANSPORTATION (${sizeStr})`;
    const countLabel = `${totalCount} Container${totalCount > 1 ? 's' : ''} (${sizeStr})`;

    const descLines: string[] = [];
    descLines.push(`<div><strong>Count:</strong> ${countLabel}</div>`);
    const hasV = truckNumbers.length > 0;
    const hasC = containerNumbers.length > 0;
    if (hasV || hasC) {
      const vText = hasV ? `<strong>Vehicle No:</strong> ${truckNumbers.join(', ')}` : '';
      const sep = (hasV && hasC) ? ' &nbsp;|&nbsp; ' : '';
      const cText = hasC ? `<strong>Container No:</strong> ${containerNumbers.join(', ')}` : '';
      descLines.push(`<div>${vText}${sep}${cText}</div>`);
    }
    if (containerFrom && containerTo) descLines.push(`<div><strong>Route:</strong> ${containerFrom} TO ${containerTo}</div>`);

    const descriptionHtml = `
      <div style="font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #000; margin-bottom: 2px;">
        ${prodTitle}
      </div>
      <div style="font-size: 11px; line-height: 1.35; color: #222;">
        ${descLines.join('')}
      </div>
    `.trim();

    charges.push({
      sNo: currentSNo++,
      description: prodTitle,
      descriptionHtml,
      freightFormula: freightAmt > 0 ? `${totalCount} X ${formatINR(unitRate)}` : undefined,
      freightCharges: freightAmt > 0 ? freightAmt : null,
      otherCharges: null,
      haltingCharges: null,
      advance: null,
      rate: null,
      amount: freightAmt,
    });

    freightTotal = freightAmt;
    grandTotal = freightAmt;
  }

  // Preserve official bill total if specified in production record
  const officialTotal = Number(bill.totalAmount) || grandTotal;
  if (grandTotal === 0 && officialTotal > 0) {
    freightTotal = officialTotal;
    grandTotal = officialTotal;
  }

  // 6. Number to words
  const totalInWords = numberToWordsINR(officialTotal);

  return {
    id: bill.id,
    billNumber: bill.billNumber || bill.id,
    billDate: formatDateDDMMYYYY(bill.billingDate || bill.createdAt),
    rawDate: bill.billingDate || bill.createdAt,
    financialYear: bill.financialYear || '2026-27',
    status: bill.status || 'PROCESSED',

    client: {
      id: bill.clientId,
      name: clientName,
      address: clientAddress,
    },

    company: {
      id: bill.companyId || 'CMP-001',
      name: bill.companyName || 'SRI PONNIAMMAN TRANS',
      address: 'No. 12/1, Coral Merchant Street, Chennai - 600 001.',
      gstin: '33ASLPD2964M1ZH',
      pan: 'ASLPD2964M',
      phone: 'Tel: 42061100, Cell: 99417 80675',
      email: 'dharmasriponniammantrans@gmail.com',
    },

    loadType,
    containerFrom,
    containerTo,
    routeText: `${containerFrom} TO ${containerTo}`,

    truckCount20,
    truckCount40,

    truckNumbers,
    containerNumbers,

    charges,

    totals: {
      freightTotal,
      otherChargesTotal,
      haltingTotal,
      advanceTotal,
      grandTotal: officialTotal,
    },

    totalInWords,

    assets: {
      headerImage: getAssetDataUri('header.png'),
      sealImage: getAssetDataUri('seal.png'),
      signatureImage: getAssetDataUri('signature.png'),
    },
  };
}
