/**
 * Transport & Logistics Management System (TMS) - Google Apps Script Backend
 * Phase 2 - Project Scaffolding & Health Check
 */

// Action Handler Registry
const ACTION_HANDLERS = {
  health: handleHealthCheck,
  setup: function() {
    return createAllSheets();
  },
  seedDev: function() {
    return seedDevData();
  },
  runTests: function() {
    return runAllTests();
  },
  runVendorTests: function() {
    TestHarness.reset();
    testVendorSuite();
    const passed = TestHarness.results.filter((r) => r.passed).length;
    const total = TestHarness.results.length;
    return {
      success: passed === total,
      total,
      passed,
      failed: total - passed,
      results: TestHarness.results,
    };
  },
  // Auth Module Actions
  'auth.login': function(payload) {
    return AuthModule.login(payload);
  },
  'auth.logout': function(payload, sessionToken) {
    return AuthModule.logout(sessionToken);
  },
  'auth.me': function(payload, sessionToken) {
    return AuthModule.me(sessionToken);
  },
  'auth.changePassword': function(payload, sessionToken) {
    return AuthModule.changePassword(payload, sessionToken);
  },

  // Master Data Generic Actions: Companies
  'companies.list': function(payload, sessionToken) { return MasterDataModule.list('companies', payload, sessionToken); },
  'companies.get': function(payload, sessionToken) { return MasterDataModule.get('companies', payload.id, sessionToken); },
  'companies.create': function(payload, sessionToken) { return MasterDataModule.create('companies', payload, sessionToken); },
  'companies.update': function(payload, sessionToken) { return MasterDataModule.update('companies', payload.id, payload.patch || payload, sessionToken); },
  'companies.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('companies', payload.id, sessionToken); },
  'companies.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('companies', payload.id, sessionToken); },
  'companies.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('companies', payload, sessionToken); },

  // Master Data Generic Actions: Clients
  'clients.list': function(payload, sessionToken) { return MasterDataModule.list('clients', payload, sessionToken); },
  'clients.get': function(payload, sessionToken) { return MasterDataModule.get('clients', payload.id, sessionToken); },
  'clients.create': function(payload, sessionToken) { return MasterDataModule.create('clients', payload, sessionToken); },
  'clients.update': function(payload, sessionToken) { return MasterDataModule.update('clients', payload.id, payload.patch || payload, sessionToken); },
  'clients.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('clients', payload.id, sessionToken); },
  'clients.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('clients', payload.id, sessionToken); },
  'clients.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('clients', payload, sessionToken); },

  // Master Data Generic Actions: Vendors
  'vendors.list': function(payload, sessionToken) { return MasterDataModule.list('vendors', payload, sessionToken); },
  'vendors.get': function(payload, sessionToken) { return MasterDataModule.get('vendors', payload.id, sessionToken); },
  'vendors.create': function(payload, sessionToken) { return MasterDataModule.create('vendors', payload, sessionToken); },
  'vendors.update': function(payload, sessionToken) { return MasterDataModule.update('vendors', payload.id, payload.patch || payload, sessionToken); },
  'vendors.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('vendors', payload.id, sessionToken); },
  'vendors.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('vendors', payload.id, sessionToken); },
  'vendors.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('vendors', payload, sessionToken); },

  // Master Data Generic Actions: Vehicles
  'vehicles.list': function(payload, sessionToken) { return MasterDataModule.list('vehicles', payload, sessionToken); },
  'vehicles.get': function(payload, sessionToken) { return MasterDataModule.get('vehicles', payload.id, sessionToken); },
  'vehicles.create': function(payload, sessionToken) { return MasterDataModule.create('vehicles', payload, sessionToken); },
  'vehicles.update': function(payload, sessionToken) { return MasterDataModule.update('vehicles', payload.id, payload.patch || payload, sessionToken); },
  'vehicles.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('vehicles', payload.id, sessionToken); },
  'vehicles.delete': function(payload, sessionToken) { return MasterDataModule.deactivate('vehicles', payload.id, sessionToken); },
  'vehicles.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('vehicles', payload.id, sessionToken); },
  'vehicles.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('vehicles', payload, sessionToken); },
  'vehicles.alerts': function(payload, sessionToken) { return MasterDataModule.getVehicleExpiryAlerts(); },

  // Master Data Generic Actions: Drivers
  'drivers.list': function(payload, sessionToken) { return MasterDataModule.list('drivers', payload, sessionToken); },
  'drivers.get': function(payload, sessionToken) { return MasterDataModule.get('drivers', payload.id, sessionToken); },
  'drivers.create': function(payload, sessionToken) { return MasterDataModule.create('drivers', payload, sessionToken); },
  'drivers.update': function(payload, sessionToken) { return MasterDataModule.update('drivers', payload.id, payload.patch || payload, sessionToken); },
  'drivers.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('drivers', payload.id, sessionToken); },
  'drivers.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('drivers', payload.id, sessionToken); },
  'drivers.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('drivers', payload, sessionToken); },

  // Containers Actions
  'containers.list': function(payload, sessionToken) { return MasterDataModule.list('containers', payload, sessionToken); },
  'containers.get': function(payload, sessionToken) { return MasterDataModule.get('containers', payload.id, sessionToken); },
  'containers.create': function(payload, sessionToken) { return MasterDataModule.create('containers', payload, sessionToken); },
  'containers.update': function(payload, sessionToken) { return MasterDataModule.update('containers', payload.id, payload.patch || payload, sessionToken); },
  'containers.deactivate': function(payload, sessionToken) { return MasterDataModule.deactivate('containers', payload.id, sessionToken); },
  'containers.reactivate': function(payload, sessionToken) { return MasterDataModule.reactivate('containers', payload.id, sessionToken); },
  'containers.lookup': function(payload, sessionToken) { return MasterDataModule.lookup('containers', payload, sessionToken); },


  // Enquiry Module Actions
  'enquiry.create': function(payload, sessionToken) { return EnquiryModule.create(payload, sessionToken); },
  'enquiry.list': function(payload, sessionToken) { return EnquiryModule.list(payload, sessionToken); },
  'enquiry.get': function(payload, sessionToken) { return EnquiryModule.get(payload.id, sessionToken); },
  'enquiry.update': function(payload, sessionToken) { return EnquiryModule.update(payload.id, payload.patch || payload, sessionToken); },
  'enquiry.delete': function(payload, sessionToken) { return EnquiryModule.delete(payload.id, sessionToken); },
  'enquiry.updateMovement': function(payload, sessionToken) { return EnquiryModule.updateMovement(payload.id || payload.enquiryId, payload.movement || payload, sessionToken); },
  'enquiry.moveStage': function(payload, sessionToken) { return EnquiryModule.moveStage(payload.id || payload.enquiryId, payload.toStage, payload.remarks, sessionToken); },
  'enquiry.getNextNumbers': function(payload, sessionToken) { return EnquiryModule.getNextNumbers(sessionToken); },

  // Operations Control Actions (Phase 8)
  'operations.movements': function(payload, sessionToken) { return EnquiryModule.operationsMovements(payload, sessionToken); },
  'operations.pending': function(payload, sessionToken) { return EnquiryModule.operationsPending(payload, sessionToken); },
  'operations.completed': function(payload, sessionToken) { return EnquiryModule.operationsCompleted(payload, sessionToken); },

  // Expenses Module Actions (Phase 9)
  'loadingExpense.list': function(payload, sessionToken) { return ExpensesModule.listLoading(payload, sessionToken); },
  'loadingExpense.get': function(payload, sessionToken) { return ExpensesModule.getLoading(payload.id, sessionToken); },
  'loadingExpense.create': function(payload, sessionToken) { return ExpensesModule.createLoading(payload, sessionToken); },
  'loadingExpense.update': function(payload, sessionToken) { return ExpensesModule.updateLoading(payload.id, payload.patch || payload, sessionToken); },
  'loadingExpense.delete': function(payload, sessionToken) { return ExpensesModule.deleteLoading(payload.id, sessionToken); },

  'generalExpense.list': function(payload, sessionToken) { return ExpensesModule.listGeneral(payload, sessionToken); },
  'generalExpense.get': function(payload, sessionToken) { return ExpensesModule.getGeneral(payload.id, sessionToken); },
  'generalExpense.create': function(payload, sessionToken) { return ExpensesModule.createGeneral(payload, sessionToken); },
  'generalExpense.update': function(payload, sessionToken) { return ExpensesModule.updateGeneral(payload.id, payload.patch || payload, sessionToken); },
  'generalExpense.delete': function(payload, sessionToken) { return ExpensesModule.deleteGeneral(payload.id, sessionToken); },

  // Vendor Management Actions (Phase 10)
  'vendorPayment.list': function(payload, sessionToken) { return VendorModule.listPayments(payload, sessionToken); },
  'vendorPayment.get': function(payload, sessionToken) { return VendorModule.getPayment(payload.id, sessionToken); },
  'vendorPayment.create': function(payload, sessionToken) { return VendorModule.createPayment(payload, sessionToken); },
  'vendorPayment.update': function(payload, sessionToken) { return VendorModule.updatePayment(payload.id, payload.patch || payload, sessionToken); },
  'vendorPayment.delete': function(payload, sessionToken) { return VendorModule.deletePayment(payload.id, sessionToken); },
  'vendor.trips': function(payload, sessionToken) { return VendorModule.getVendorTrips(payload.vendorId || payload.id, sessionToken); },
  'vendor.report': function(payload, sessionToken) { return VendorModule.getVendorReport(payload, sessionToken); },

  // Settings & System Audit Actions (Phase 11)
  'settings.get': function(payload, sessionToken) { return SettingsModule.getSettings(); },
  'settings.update': function(payload, sessionToken) { return SettingsModule.updateSettings(payload); },
  'settings.uploadSeal': function(payload, sessionToken) { return SettingsModule.uploadSeal(payload); },
  'settings.removeSeal': function(payload, sessionToken) { return SettingsModule.removeSeal(); },
  'settings.uploadSignature': function(payload, sessionToken) { return SettingsModule.uploadSignature(payload); },
  'settings.removeSignature': function(payload, sessionToken) { return SettingsModule.removeSignature(); },
  'settings.previewNextBillNumber': function(payload, sessionToken) { return SettingsModule.previewNextBillNumber(payload.dateStr); },
  'audit.list': function(payload, sessionToken) { return SettingsModule.listAuditLogs(payload); },
  'audit.ensureLocations': function(payload, sessionToken) { return AuditModule.ensureAuditLocations(); },

  // Document Management Actions (Strictly Vehicle Documents)
  'documents.upload': function(payload, sessionToken) { return DocumentServiceModule.uploadVehicleDocuments(payload, sessionToken); },
  'documents.list': function(payload, sessionToken) { return DocumentServiceModule.getVehicleDocuments(payload.vehicleId || payload.entityId, sessionToken); },
  'documents.get': function(payload, sessionToken) { return DocumentServiceModule.getDocument(payload.id || payload.documentId, sessionToken); },
  'documents.content': function(payload, sessionToken) { return DocumentServiceModule.getDocumentContent(payload.id || payload.documentId, sessionToken); },
  'documents.delete': function(payload, sessionToken) { return DocumentServiceModule.deleteDocument(payload.id || payload.documentId, sessionToken); },
  'documents.rename': function(payload, sessionToken) { return DocumentServiceModule.renameDocument(payload.id || payload.documentId, payload.fileName || payload.newName, sessionToken); },
  'documents.folder': function(payload, sessionToken) { return DocumentServiceModule.getVehicleFolderUrl(payload.vehicleId || payload.entityId, sessionToken); },
  'documents.auth': function(payload, sessionToken) { return { authorized: DriveServiceModule.isDriveAuthorized() }; },
  'documents.sync': function(payload, sessionToken) { return DocumentServiceModule.syncPendingDocuments(sessionToken); },

  // Dashboard Module Actions (Phase 18)
  'dashboard.summary': function(payload, sessionToken) { return DashboardModule.getDashboardSummary(); },

  // Trashbin Actions
  'trashbin.list': function(payload, sessionToken) { return TrashbinModule.listTrash(payload, sessionToken); },
  'trashbin.restore': function(payload, sessionToken) { return TrashbinModule.restore(payload.category, payload.id, sessionToken); },
  'trashbin.purge': function(payload, sessionToken) { return TrashbinModule.purge(payload.category, payload.id, sessionToken); },
  'trashbin.ensure': function(payload, sessionToken) { return TrashbinModule.ensureTrashbinSheets(); },

  // Export Module Actions
  'export.masterXlsx': function(payload, sessionToken) { return ExportModule.exportMasterXlsx(); },
  'export.reportCsv': function(payload, sessionToken) { return ExportModule.exportReportCsv(payload); },

  // Expense Aliases
  'expenses.general.list': function(payload, sessionToken) { return ExpensesModule.listGeneral(payload, sessionToken); },
  'expenses.loading.list': function(payload, sessionToken) { return ExpensesModule.listLoading(payload, sessionToken); },

  // Master Data Aliases
  'master.customers': function(payload, sessionToken) { return MasterDataModule.list('clients', payload, sessionToken); },
  'master.clients': function(payload, sessionToken) { return MasterDataModule.list('clients', payload, sessionToken); },
  'master.companies': function(payload, sessionToken) { return MasterDataModule.list('companies', payload, sessionToken); },
  'master.vendors': function(payload, sessionToken) { return MasterDataModule.list('vendors', payload, sessionToken); },
  'master.vehicles': function(payload, sessionToken) { return MasterDataModule.list('vehicles', payload, sessionToken); },
  'master.drivers': function(payload, sessionToken) { return MasterDataModule.list('drivers', payload, sessionToken); },
  'master.containers': function(payload, sessionToken) { return MasterDataModule.list('containers', payload, sessionToken); },

  // Billing Module Actions (Phase 12)
  'bill.pending': function(payload, sessionToken) { return BillingModule.listPending(payload); },
  'bill.create': function(payload, sessionToken) { return BillingModule.createBill(payload); },
  'bill.deleteDraft': function(payload, sessionToken) { return BillingModule.deleteDraft(payload.id); },
  'bill.process': function(payload, sessionToken) { return BillingModule.processBill(payload); },
  'bill.updateProcessed': function(payload, sessionToken) { return BillingModule.updateProcessed(payload); },
  'bill.get': function(payload, sessionToken) { return BillingModule.getBill(payload.id); },
  'bill.list': function(payload, sessionToken) { return BillingModule.listBills(payload); },

  // Reports Module Actions (Phase 16)
  'reports.daily': function(payload, sessionToken) { return ReportsModule.getDailyReport(payload); },
  'reports.company': function(payload, sessionToken) { return ReportsModule.getCompanyReport(payload); },
  'reports.billing': function(payload, sessionToken) { return ReportsModule.getBillingReport(payload); },

  // Excel & Export Module Actions (Phase 17)
  'export.masterXlsx': function(payload, sessionToken) { return ExportModule.exportMasterXlsx(); },
  'export.reportCsv': function(payload, sessionToken) { return ExportModule.exportReportCsv(payload); },

  // PDF Module Action (Phase 14)
  'bill.generatePdf': function(payload, sessionToken) { return PDFModule.generateBillPdf(payload, sessionToken); },

  // Client Payments Module Actions (Phase 15)
  'billPayment.list': function(payload, sessionToken) { return PaymentsModule.list(payload, sessionToken); },
  'billPayment.create': function(payload, sessionToken) { return PaymentsModule.create(payload, sessionToken); },
  'billPayment.update': function(payload, sessionToken) { return PaymentsModule.update(payload, sessionToken); },
  'billPayment.delete': function(payload, sessionToken) { return PaymentsModule.delete(payload, sessionToken); },
  'billPayment.ageing': function(payload, sessionToken) { return PaymentsModule.ageing(payload, sessionToken); },

  // Live Reporting Workbooks Synchronization Actions
  'reporting.syncDailyRow': function(payload) { return ReportingSyncModule.syncDailyRow(payload); },
  'reporting.deleteDailyRow': function(payload) { return ReportingSyncModule.deleteDailyRow(payload); },
  'reporting.syncClientRow': function(payload) { return ReportingSyncModule.syncClientRow(payload); },
  'reporting.deleteClientRow': function(payload) { return ReportingSyncModule.deleteClientRow(payload); },
  'reporting.ensureClientSheet': function(payload) { return ReportingSyncModule.ensureClientSheet(payload); },
  'reporting.syncCompanyRow': function(payload) { return ReportingSyncModule.syncCompanyRow(payload); },
  'reporting.deleteCompanyRow': function(payload) { return ReportingSyncModule.deleteCompanyRow(payload); },
  'reporting.ensureCompanySheet': function(payload) { return ReportingSyncModule.ensureCompanySheet(payload); },
  'reporting.syncBillRow': function(payload) { return ReportingSyncModule.syncBillRow(payload); },
  'reporting.deleteBillRow': function(payload) { return ReportingSyncModule.deleteBillRow(payload); },
  'reporting.initialFullSync': function(payload) { return ReportingSyncModule.initialFullSync(payload); },

  // System Seeding & Reset Actions
  'system.resetAndSeedEdgeCases': function(payload, sessionToken) { return seedRealEdgeCaseData(payload); },

  // Trashbin & Data Recovery Vault Actions
  'trashbin.list': function(payload, sessionToken) { return TrashbinModule.listTrash(payload, sessionToken); },
  'trashbin.restore': function(payload, sessionToken) { return TrashbinModule.restore(payload.category, payload.id, sessionToken); },
};




/**
 * Direct Toolbar Runner Functions
 * These appear in the top toolbar function dropdown regardless of which file is selected.
 */
function createAllSheetsRunner() {
  const res = createAllSheets();
  Logger.log('createAllSheets: ' + JSON.stringify(res));
  return res;
}

function seedDevDataRunner() {
  const res = seedDevData();
  Logger.log('seedDevData: ' + JSON.stringify(res));
  return res;
}

function runAllTestsRunner() {
  const res = runAllTests();
  Logger.log('runAllTests: ' + JSON.stringify(res));
  return res;
}

/**
 * Main Web App POST Entrypoint
 */
function doPost(e) {
  try {
    // 1. Verify Post Data exists
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Missing request body",
        errors: [{ message: "Missing request body" }],
      });
    }

    // 2. Parse request payload
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Malformed JSON payload",
        errors: [{ message: parseErr.message }],
      });
    }

    const action = body.action;
    const payload = body.payload || {};
    const sessionToken = body.sessionToken || null;

    // 3. Verify Shared Secret
    const scriptProperties = PropertiesService.getScriptProperties();
    const configuredSecret = scriptProperties.getProperty("SHARED_SECRET");

    // Allow secret from query params, body.secret, or headers if present
    const incomingSecret =
      (e.parameter && e.parameter.secret) ||
      body.secret ||
      (e.headers && (e.headers["x-tms-proxy-secret"] || e.headers["X-Tms-Proxy-Secret"]));

    if (configuredSecret && incomingSecret !== configuredSecret) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Forbidden: Invalid or missing proxy secret",
        errors: [{ code: "FORBIDDEN", message: "Unauthorized proxy caller" }],
      });
    }

    // 4. Validate Action
    if (!action) {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Bad Request: Action parameter is required",
        errors: [{ message: "Missing action" }],
      });
    }

    const handler = ACTION_HANDLERS[action];
    if (typeof handler !== "function") {
      return createJsonResponse({
        success: false,
        data: null,
        message: "Action not supported: " + action,
        errors: [{ code: "ACTION_NOT_FOUND", message: "Unknown action: " + action }],
      });
    }

    // 5. Execute Action Handler
    const result = handler(payload, sessionToken);

    return createJsonResponse({
      success: true,
      data: result,
      message: "Operation completed successfully",
      errors: [],
    });
  } catch (error) {
    // Catch-all to prevent raw stack trace leakage
    return createJsonResponse({
      success: false,
      data: null,
      message: error.message || "An unexpected server error occurred",
      errors: [{ message: error.message || "Internal error" }],
    });
  }
}

/**
 * Health Check Action Handler
 * Verifies connectivity to the configured Google Spreadsheet.
 */
function handleHealthCheck(payload, sessionToken) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("Configuration Error: SPREADSHEET_ID is not set in Script Properties.");
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    return {
      ok: true,
      sheetConnected: true,
      spreadsheetName: spreadsheet.getName(),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error("Failed to connect to Google Sheet with ID '" + spreadsheetId + "': " + err.message);
  }
}

/**
 * Web App GET Entrypoint (Convenience / Ping)
 */
function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.action || e.parameter.data)) {
      var action = e.parameter.action;
      var payload = {};
      var sessionToken = e.parameter.sessionToken || '';

      if (e.parameter.data) {
        try {
          var parsed = JSON.parse(e.parameter.data);
          if (parsed.action) action = parsed.action;
          if (parsed.payload) payload = parsed.payload;
          if (parsed.sessionToken) sessionToken = parsed.sessionToken;
        } catch (pe) {
          // ignore
        }
      } else if (e.parameter.payload) {
        try {
          payload = JSON.parse(e.parameter.payload);
        } catch (pe) {
          payload = e.parameter.payload;
        }
      }

      if (action && ACTION_HANDLERS[action]) {
        var handler = ACTION_HANDLERS[action];
        var result = handler(payload, sessionToken);
        return createJsonResponse({
          success: true,
          data: result,
          message: "Operation completed successfully",
          errors: [],
        });
      }
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      data: null,
      message: err.message || "An unexpected server error occurred",
      errors: [{ message: err.message || "Internal error" }],
    });
  }

  return createJsonResponse({
    success: true,
    data: {
      service: "Transport Logistics Management System (TMS) API",
      status: "online",
      runtime: "Apps Script V8",
      timestamp: new Date().toISOString(),
    },
    message: "TMS Apps Script Web App is active and operational.",
    errors: [],
  });
}

/**
 * Helper to construct JSON response
 */
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Direct authorization helper function.
 * Script owner can run this function directly in Apps Script editor to grant full Drive write permissions.
 * NOTE: DriveApp.createFolder is called directly WITHOUT try/catch so Google Apps Script
 * intercepts it and displays the "Authorization required" permission dialog for full write access!
 */
function authorizeDriveAccess() {
  // 1. Direct createFolder call to trigger full Drive write permission dialog (https://www.googleapis.com/auth/drive)
  var authTestFolder = DriveApp.createFolder('__auth_test_drive__');
  authTestFolder.setTrashed(true);

  // 2. Resolve root folder and sync all pending vehicle documents
  var root = DriveApp.getRootFolder();
  var appFolder = DriveServiceModule.getRootFolder();
  var syncResult = DriveServiceModule.syncPendingDocumentsToDrive();
  Logger.log('SUCCESS: Google Drive full write access authorized! Root: ' + (appFolder ? appFolder.getName() : root.getName()) + '. ' + syncResult.message);
  return {
    success: true,
    message: 'Google Drive authorization is ACTIVE and operational. ' + syncResult.message,
    rootName: root ? root.getName() : '',
    appFolderName: appFolder ? appFolder.getName() : '',
    syncedDocuments: syncResult.count || 0
  };
}
