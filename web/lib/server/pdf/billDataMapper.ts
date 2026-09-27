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
  vehicleNo?: string;
  vehicleNumber?: string;
  containerNo?: string;
  containerNumber?: string;
  containerSize?: string;
  noOfContainers?: number;
  truckCount20?: number;
  truckCount40?: number;
  containerFrom?: string;
  containerTo?: string;
  freightAmount?: number;
  haltingAmount?: number;
  advanceAmount?: number;
  otherCharges?: number;
  clientAddress?: string;
  billId?: string;
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

  // 4. Resolve Route & Container Sizes
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
    const vNo = e.vehicleNo || e.vehicleNumber;
    if (vNo && vNo !== '-') truckNumbersSet.add(vNo.trim());

    // Container numbers
    const cNo = e.containerNo || e.containerNumber;
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
        truckCount40 += num; // default to 40 FT as standard container size in logistics
      }
    }
  });

  const truckNumbers = Array.from(truckNumbersSet);
  const containerNumbers = Array.from(containerNumbersSet);

  // 5. Build Dynamic Charges Table
  const rawItems: RawBillItem[] = Array.isArray(bill.items) ? bill.items : [];
  const charges: BillChargeItem[] = [];

  let freightTotal = 0;
  let otherChargesTotal = 0;
  let haltingTotal = 0;
  let advanceTotal = 0;
  let grandTotal = 0;

  let currentSNo = 1;

  // Primary Freight Charges row
  let freightAmt = 0;
  rawItems.forEach((it) => {
    const desc = (it.description || '').toLowerCase();
    const amt = Number(it.amount) || 0;
    if (desc.includes('freight') || desc.includes('transport') || desc.includes('container') || (!desc.includes('halting') && !desc.includes('other') && !desc.includes('advance'))) {
      freightAmt += amt;
    }
  });

  if (freightAmt === 0 && linkedEnquiries.length > 0) {
    freightAmt = linkedEnquiries.reduce((sum, e) => sum + (Number(e.freightAmount) || 0), 0);
  }
  if (freightAmt === 0 && bill.totalAmount) {
    freightAmt = Number(bill.subtotal || bill.totalAmount) || 0;
  }

  // Row 1: Freight Charges
  charges.push({
    sNo: currentSNo++,
    description: 'Freight Charges',
    freightCharges: freightAmt,
    otherCharges: null,
    haltingCharges: null,
    advance: null,
    rate: null,
    amount: freightAmt,
  });
  freightTotal += freightAmt;
  grandTotal += freightAmt;

  // Row 2: Truck Number (Itemized multiline display)
  if (truckNumbers.length > 0) {
    charges.push({
      sNo: currentSNo++,
      description: `Truck Number\n${truckNumbers.join('\n')}`,
      freightCharges: null,
      otherCharges: null,
      haltingCharges: null,
      advance: null,
      rate: null,
      amount: 0,
    });
  }

  // Row 3: Container Number (Itemized multiline display)
  if (containerNumbers.length > 0) {
    charges.push({
      sNo: currentSNo++,
      description: `Container Number\n${containerNumbers.join('\n')}`,
      freightCharges: null,
      otherCharges: null,
      haltingCharges: null,
      advance: null,
      rate: null,
      amount: 0,
    });
  }

  // Row 4: Additional Charges / Other Charges
  let otherAmt = 0;
  rawItems.forEach((it) => {
    const desc = (it.description || '').toLowerCase();
    if (desc.includes('other') || desc.includes('additional') || desc.includes('diesel') || desc.includes('toll')) {
      otherAmt += Number(it.amount) || 0;
    }
  });
  if (otherAmt === 0 && linkedEnquiries.length > 0) {
    otherAmt = linkedEnquiries.reduce((sum, e) => sum + (Number(e.otherCharges) || 0), 0);
  }
  if (otherAmt > 0) {
    charges.push({
      sNo: currentSNo++,
      description: 'Additional Charges',
      freightCharges: null,
      otherCharges: otherAmt,
      haltingCharges: null,
      advance: null,
      rate: null,
      amount: otherAmt,
    });
    otherChargesTotal += otherAmt;
    grandTotal += otherAmt;
  }

  // Row 5: Halting Charges
  let haltingAmt = 0;
  rawItems.forEach((it) => {
    const desc = (it.description || '').toLowerCase();
    if (desc.includes('halting')) {
      haltingAmt += Number(it.amount) || 0;
    }
  });
  if (haltingAmt === 0 && linkedEnquiries.length > 0) {
    haltingAmt = linkedEnquiries.reduce((sum, e) => sum + (Number(e.haltingAmount) || 0), 0);
  }
  if (haltingAmt > 0) {
    charges.push({
      sNo: currentSNo++,
      description: 'Halting Charges',
      freightCharges: null,
      otherCharges: null,
      haltingCharges: haltingAmt,
      advance: null,
      rate: null,
      amount: haltingAmt,
    });
    haltingTotal += haltingAmt;
    grandTotal += haltingAmt;
  }

  // Row 6: Advance Amount
  let advanceAmt = 0;
  if (linkedEnquiries.length > 0) {
    advanceAmt = linkedEnquiries.reduce((sum, e) => sum + (Number(e.advanceAmount) || 0), 0);
  }
  if (advanceAmt > 0) {
    charges.push({
      sNo: currentSNo++,
      description: 'Advance Amount',
      freightCharges: null,
      otherCharges: null,
      haltingCharges: null,
      advance: advanceAmt,
      rate: null,
      amount: advanceAmt,
    });
    advanceTotal += advanceAmt;
  }

  // Preserve official bill total if specified in production record
  const officialTotal = Number(bill.totalAmount) || grandTotal;

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
