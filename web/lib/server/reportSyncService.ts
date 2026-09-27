import { callAppsScript } from './appsScriptClient';

export interface DailyReportRecord {
  id: string;
  creationDate: string;
  bookingDate: string;
  companyName: string;
  loadingType: string;
  clientName: string;
  billingNumber: string;
  bookingNumber: string;
  feet: string;
  containerNumber: string;
  sealNumber: string;
  vehicleNumber: string;
  driverNumber: string;
  diesel: number;
  advance: number;
  companyIn: string;
  companyOut: string;
  printIn: string;
  printOut: string;
  portIn: string;
  portOut: string;
  movementStatus: string;
  shippingStatus: string;
  comments: string;
}

export interface ProcessedBillRecord {
  id: string;
  billNumber: string;
  companyName: string;
  clientName: string;
  billingDate: string;
  financialYear: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  processedAt?: string;
}

function getSpreadsheetIds() {
  const clean = (val?: string) => (val ? val.trim().replace(/^["']|["']$/g, '') : '');
  return {
    dailySpreadsheetId: clean(process.env.DAILY_REPORT_SPREADSHEET_ID),
    companySpreadsheetId: clean(process.env.COMPANY_REPORT_SPREADSHEET_ID),
    processedBillsSpreadsheetId: clean(process.env.PROCESSED_BILLS_SPREADSHEET_ID),
  };
}

function normalizeDate(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') {
    if (d.includes('T')) return d.substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parts = d.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return String(d).substring(0, 10);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return String(d).substring(0, 10);
  }
}

/**
 * Maps raw enquiry object to standardized 23-column Daily Report format
 */
export function mapEnquiryToDailyRecord(enquiry: any): DailyReportRecord {
  const mov = enquiry.movement || {};
  return {
    id: enquiry.id || '',
    creationDate: normalizeDate(enquiry.createdAt || enquiry.date),
    bookingDate: normalizeDate(enquiry.bookingDate || enquiry.date || enquiry.createdAt),
    companyName: enquiry.companyName || enquiry.companyId || 'General',
    loadingType: enquiry.loadingType || 'Import',
    clientName: enquiry.clientName || enquiry.clientId || '',
    billingNumber: enquiry.billingNumber || enquiry.billNumber || enquiry.billId || '-',
    bookingNumber: enquiry.transactionNumber || enquiry.transactionNo || enquiry.bookingNumber || enquiry.id || '',
    feet: enquiry.containerSize || enquiry.feet || '40 FT',
    containerNumber: enquiry.containerNumber || enquiry.containerNo || '',
    sealNumber: enquiry.sealNumber || '-',
    vehicleNumber: enquiry.vehicleNumber || enquiry.vehicleNo || '',
    driverNumber: enquiry.driverInfo || enquiry.driverPhone || '-',
    diesel: Number(enquiry.dieselAmount || enquiry.diesel || 0),
    advance: Number(enquiry.advanceAmount || enquiry.advance || 0),
    companyIn: mov.companyInTime || enquiry.companyIn || '',
    companyOut: mov.companyOutTime || enquiry.companyOut || '',
    printIn: mov.printInTime || enquiry.printIn || '',
    printOut: mov.printOutTime || enquiry.printOut || '',
    portIn: mov.portInTime || enquiry.portIn || '',
    portOut: mov.portOutTime || enquiry.portOut || '',
    movementStatus: mov.movementStatus || enquiry.movementStatus || 'NOT_MOVED',
    shippingStatus: mov.shippingStatus || enquiry.shippingStatus || 'PENDING',
    comments: enquiry.remarks || enquiry.comments || '',
  };
}

/**
 * LIVE SYNC: Enquiry Upsert (Daily Report & Client-Wise Report)
 */
export async function syncEnquiryToReports(
  enquiry: any,
  oldClientName?: string,
  sessionToken?: string | null
): Promise<void> {
  const ids = getSpreadsheetIds();
  if (!ids.dailySpreadsheetId && !ids.companySpreadsheetId) {
    return;
  }

  const record = mapEnquiryToDailyRecord(enquiry);
  const payload = {
    ...record,
    oldClientName: oldClientName || '',
    oldCompanyName: oldClientName || '',
    dailySpreadsheetId: ids.dailySpreadsheetId,
    companySpreadsheetId: ids.companySpreadsheetId,
    clientSpreadsheetId: ids.companySpreadsheetId,
  };

  try {
    console.log(`[ReportSync] Syncing enquiry ${record.id} to Daily & Client-Wise workbooks...`);
    const [dailyRes, clientRes] = await Promise.all([
      ids.dailySpreadsheetId
        ? callAppsScript('reporting.syncDailyRow', payload, sessionToken)
        : Promise.resolve({ success: true, message: '' }),
      ids.companySpreadsheetId
        ? callAppsScript('reporting.syncClientRow', payload, sessionToken)
        : Promise.resolve({ success: true, message: '' }),
    ]);

    if (!dailyRes.success) {
      console.error('[ReportSync] Daily Report sync error:', dailyRes.message);
    }
    if (!clientRes.success) {
      console.error('[ReportSync] Client Report sync error:', clientRes.message);
    }
  } catch (err: any) {
    console.error('[ReportSync] Failed to sync enquiry to reporting workbooks:', err?.message || err);
  }
}

/**
 * LIVE SYNC: Enquiry Deletion (Daily Report & Client-Wise Report)
 */
export async function deleteEnquiryFromReports(
  enquiryId: string,
  clientName?: string,
  sessionToken?: string | null
): Promise<void> {
  const ids = getSpreadsheetIds();
  const payload = {
    id: enquiryId,
    enquiryId,
    clientName: clientName || '',
    companyName: clientName || '',
    dailySpreadsheetId: ids.dailySpreadsheetId,
    companySpreadsheetId: ids.companySpreadsheetId,
  };

  try {
    console.log(`[ReportSync] Deleting enquiry ${enquiryId} from reporting workbooks...`);
    await Promise.all([
      ids.dailySpreadsheetId
        ? callAppsScript('reporting.deleteDailyRow', payload, sessionToken)
        : Promise.resolve({ success: true }),
      ids.companySpreadsheetId
        ? callAppsScript('reporting.deleteClientRow', payload, sessionToken)
        : Promise.resolve({ success: true }),
    ]);
  } catch (err: any) {
    console.error('[ReportSync] Failed to delete enquiry from reporting workbooks:', err?.message || err);
  }
}

/**
 * LIVE SYNC: New Client Created -> Ensure dynamic tab in Client-Wise Report
 */
export async function syncClientCreationToReports(
  clientName: string,
  sessionToken?: string | null
): Promise<void> {
  const ids = getSpreadsheetIds();
  if (!ids.companySpreadsheetId || !clientName) return;

  try {
    console.log(`[ReportSync] Creating client sheet for "${clientName}"...`);
    await callAppsScript(
      'reporting.ensureClientSheet',
      {
        clientName,
        companySpreadsheetId: ids.companySpreadsheetId,
      },
      sessionToken
    );
  } catch (err: any) {
    console.error('[ReportSync] Failed to ensure client sheet:', err?.message || err);
  }
}

/**
 * LIVE SYNC: New Company Created -> Alias/support
 */
export async function syncCompanyCreationToReports(
  companyName: string,
  sessionToken?: string | null
): Promise<void> {
  return syncClientCreationToReports(companyName, sessionToken);
}


/**
 * LIVE SYNC: Processed Bill Upsert
 */
export async function syncProcessedBillToReports(
  bill: any,
  sessionToken?: string | null
): Promise<void> {
  const ids = getSpreadsheetIds();
  if (!ids.processedBillsSpreadsheetId) return;

  const payload: ProcessedBillRecord & { processedBillsSpreadsheetId: string } = {
    id: bill.id || '',
    billNumber: bill.billNumber || bill.id || '',
    companyName: bill.companyName || bill.companyId || '',
    clientName: bill.clientName || bill.clientId || '',
    billingDate: normalizeDate(bill.billingDate || bill.createdAt),
    financialYear: bill.financialYear || '',
    subtotal: Number(bill.subtotal || 0),
    taxAmount: Number(bill.taxAmount || 0),
    totalAmount: Number(bill.totalAmount || 0),
    paidAmount: Number(bill.paidAmount || 0),
    outstandingAmount: Number(bill.outstandingAmount || 0),
    status: 'PROCESSED',
    processedAt: bill.processedAt || bill.updatedAt || new Date().toISOString(),
    processedBillsSpreadsheetId: ids.processedBillsSpreadsheetId,
  };

  try {
    console.log(`[ReportSync] Syncing bill ${payload.billNumber} to Processed Bills workbook...`);
    const res = await callAppsScript('reporting.syncBillRow', payload, sessionToken);
    if (!res.success) {
      console.error('[ReportSync] Processed bill sync error:', res.message);
    }
  } catch (err: any) {
    console.error('[ReportSync] Failed to sync bill to reporting workbook:', err?.message || err);
  }
}

/**
 * LIVE SYNC: Processed Bill Deletion
 */
export async function deleteProcessedBillFromReports(
  billId: string,
  billNumber?: string,
  sessionToken?: string | null
): Promise<void> {
  const ids = getSpreadsheetIds();
  if (!ids.processedBillsSpreadsheetId) return;

  try {
    console.log(`[ReportSync] Deleting bill ${billNumber || billId} from Processed Bills workbook...`);
    await callAppsScript(
      'reporting.deleteBillRow',
      {
        id: billId,
        billId,
        billNumber: billNumber || '',
        processedBillsSpreadsheetId: ids.processedBillsSpreadsheetId,
      },
      sessionToken
    );
  } catch (err: any) {
    console.error('[ReportSync] Failed to delete bill from reporting workbook:', err?.message || err);
  }
}

/**
 * INITIAL FULL SYNC
 */
export async function runInitialFullSync(sessionToken?: string | null) {
  const ids = getSpreadsheetIds();
  return callAppsScript('reporting.initialFullSync', ids, sessionToken);
}
