/**
 * Transport & Logistics Management System (TMS)
 * Phase 3 - Database Initialization (Google Sheets Schema)
 */

// Exact column definitions matching docs/DATABASE_DESIGN.md
const SHEET_SCHEMAS = {
  users: ['id', 'name', 'email', 'passwordHash', 'salt', 'createdAt', 'updatedAt'],
  companies: [
    'id',
    'name',
    'address',
    'contactPerson',
    'phone',
    'email',
    'gstin',
    'pan',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  clients: [
    'id',
    'name',
    'companyId',
    'contactPerson',
    'phone',
    'email',
    'address',
    'gstin',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  vendors: [
    'id',
    'name',
    'contactPerson',
    'phone',
    'email',
    'address',
    'pan',
    'bankDetails',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  vehicles: [
    'id',
    'vehicleNumber',
    'vehicleType',
    'vendorId',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  drivers: [
    'id',
    'name',
    'phone',
    'licenseNumber',
    'active',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  containers: ['id', 'containerNumber', 'containerType', 'createdAt', 'updatedAt'],
  enquiries: [
    'id',
    'enquiryNumber',
    'transactionNumber',
    'date',
    'companyId',
    'clientId',
    'loadingType',
    'vehicleId',
    'driverId',
    'containerId',
    'sealNumber',
    'stage',
    'vendorId',
    'freightAmount',
    'dieselAmount',
    'advanceAmount',
    'extraAdvance',
    'haltingDays',
    'haltingAmount',
    'bonus',
    'billId',
    'completedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  movements: [
    'id',
    'enquiryId',
    'companyInTime',
    'companyOutTime',
    'printInTime',
    'printOutTime',
    'portInTime',
    'portOutTime',
    'movementStatus',
    'shippingStatus',
    'createdAt',
    'updatedAt',
  ],
  stage_history: [
    'id',
    'enquiryId',
    'fromStage',
    'toStage',
    'direction',
    'remarks',
    'timestamp',
  ],
  loading_expenses: [
    'id',
    'expenseDate',
    'category',
    'amount',
    'description',
    'enquiryId',
    'vehicleId',
    'source',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  general_expenses: [
    'id',
    'expenseDate',
    'category',
    'amount',
    'description',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  bills: [
    'id',
    'billNumber',
    'billSeq',
    'financialYear',
    'status',
    'billingDate',
    'companyId',
    'clientId',
    'totalAmount',
    'remarks',
    'processedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  bill_items: [
    'id',
    'billId',
    'enquiryId',
    'description',
    'amount',
    'sortOrder',
    'createdAt',
    'updatedAt',
  ],
  bill_payments: [
    'id',
    'billId',
    'paymentDate',
    'amount',
    'mode',
    'reference',
    'notes',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  vendor_payments: [
    'id',
    'vendorId',
    'enquiryId',
    'paymentDate',
    'amount',
    'mode',
    'reference',
    'notes',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  number_sequences: ['sequenceKey', 'financialYear', 'currentValue', 'updatedAt'],
  app_settings: [
    'id',
    'companyName',
    'address',
    'phone',
    'email',
    'gstin',
    'pan',
    'sealFileId',
    'sealViewUrl',
    'signatureFileId',
    'signatureViewUrl',
    'enquiryStartNumber',
    'billStartNumber',
    'updatedAt',
  ],
  audit_logs: ['id', 'timestamp', 'entity', 'entityId', 'action', 'oldValue', 'newValue', 'userId'],
  sessions: ['token', 'userId', 'createdAt', 'expiresAt', 'lastActiveAt'],
};

/**
 * Idempotently creates all 20 business sheets and freezes header rows.
 */
function createAllSheets() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID property not found in Script Properties.');
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const createdSheets = [];
  const existingSheets = [];

  for (const sheetName in SHEET_SCHEMAS) {
    const headers = SHEET_SCHEMAS[sheetName];
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Batch set headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
      createdSheets.push(sheetName);
    } else {
      // If sheet exists but has no headers, set them
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
      }
      existingSheets.push(sheetName);
    }
  }

  // If a default 'Sheet1' exists and has no data, remove it cleanly
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // Ignore if cannot delete
    }
  }

  return {
    success: true,
    totalExpected: Object.keys(SHEET_SCHEMAS).length,
    created: createdSheets,
    alreadyExisting: existingSheets,
  };
}
