/**
 * Transport & Logistics Management System (TMS)
 * Page-Specific Trashbin & Data Recovery Vault Module
 * Handles moving deleted records out of active sheets into dedicated trashbin sheets:
 * - vehicle-trashbin
 * - general-expense-trashbin
 * - loading-expense-trashbin
 * - daily-report-trashbin
 * - billing-trashbin
 * - vendor-trashbin
 * - driver-trashbin
 * - container-trashbin
 * And places all testing & system sheets at the last of the master production Excel.
 */

var TrashbinModule = (function () {
  var TRASH_SCHEMAS = {
    'vehicle-trashbin': [
      'id',
      'vehicleNumber',
      'ownerName',
      'vehicleClass',
      'fuelType',
      'fitnessValidUpTo',
      'taxValidUpTo',
      'insuranceValidUpTo',
      'puccValidUpTo',
      'permitValidUpTo',
      'nationalPermitValidUpTo',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'general-expense-trashbin': [
      'id',
      'expenseDate',
      'category',
      'amount',
      'description',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'loading-expense-trashbin': [
      'id',
      'expenseDate',
      'category',
      'amount',
      'description',
      'enquiryId',
      'vehicleId',
      'source',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'daily-report-trashbin': [
      'id',
      'enquiryNumber',
      'transactionNumber',
      'date',
      'companyId',
      'clientId',
      'vehicleNo',
      'driverPhone',
      'freightAmount',
      'stage',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'billing-trashbin': [
      'id',
      'billNumber',
      'financialYear',
      'status',
      'billingDate',
      'companyId',
      'clientId',
      'totalAmount',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'vendor-trashbin': [
      'id',
      'name',
      'contactPerson',
      'phone',
      'email',
      'pan',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'driver-trashbin': [
      'id',
      'name',
      'phone',
      'licenseNumber',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
    'container-trashbin': [
      'id',
      'containerNumber',
      'containerType',
      'deletedAt',
      'deletedBy',
      'detailsJson',
    ],
  };

  /**
   * Ensures all trashbin sheets exist in the spreadsheet with headers and styling.
   */
  function ensureTrashbinSheets() {
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) return;
    var ss = SpreadsheetApp.openById(spreadsheetId);

    Object.keys(TRASH_SCHEMAS).forEach(function (sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      var headers = TRASH_SCHEMAS[sheetName];
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FEE2E2');
        sheet.setFrozenRows(1);
      } else {
        var existingCols = sheet.getLastColumn();
        if (existingCols === 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FEE2E2');
          sheet.setFrozenRows(1);
        }
      }
    });

    // Reorder tabs so testing sheets are placed at the very end of the workbook
    placeTestingSheetsAtLast();
  }

  /**
   * Places testing, audit, and system sheets at the very end of the master production Excel.
   */
  function placeTestingSheetsAtLast() {
    try {
      var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!spreadsheetId) return;
      var ss = SpreadsheetApp.openById(spreadsheetId);
      var sheets = ss.getSheets();

      var testKeywords = ['audit_logs', 'sessions', 'test', 'tests', 'testing', 'temp'];
      var testSheets = [];

      sheets.forEach(function (s) {
        var name = s.getName().toLowerCase();
        var isTest = testKeywords.some(function (k) {
          return name.indexOf(k) !== -1;
        });
        if (isTest) {
          testSheets.push(s);
        }
      });

      testSheets.forEach(function (s) {
        ss.setActiveSheet(s);
        ss.moveActiveSheet(ss.getNumSheets());
      });
    } catch (err) {
      Logger.log('placeTestingSheetsAtLast warning: ' + err.message);
    }
  }

  /**
   * Records a deleted item into its specific page trashbin sheet and removes it from the active sheet.
   */
  function recordDeletion(category, item, deletedBy) {
    if (!item || !item.id) return;
    try {
      ensureTrashbinSheets();
      var now = item.deletedAt || new Date().toISOString();
      var user = deletedBy || 'USR-001';

      if (category === 'vehicle' || category === 'vehicles') {
        var vehRecord = {
          id: String(item.id),
          vehicleNumber: item.vehicleNumber || '',
          ownerName: item.ownerName || '',
          vehicleClass: item.vehicleClass || '',
          fuelType: item.fuelType || '',
          fitnessValidUpTo: item.fitnessValidUpTo || '',
          taxValidUpTo: item.taxValidUpTo || '',
          insuranceValidUpTo: item.insuranceValidUpTo || '',
          puccValidUpTo: item.puccValidUpTo || '',
          permitValidUpTo: item.permitValidUpTo || '',
          nationalPermitValidUpTo: item.nationalPermitValidUpTo || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existing = SheetRepo.getRowById('vehicle-trashbin', item.id);
        if (existing) {
          SheetRepo.updateRow('vehicle-trashbin', item.id, vehRecord, user);
        } else {
          SheetRepo.insertRow('vehicle-trashbin', vehRecord, user);
        }
        // Physically remove from active vehicles sheet so it never lingers
        SheetRepo.hardDeleteRow('vehicles', item.id);
      } else if (category === 'general-expense' || (category === 'expense' && String(item.id).startsWith('GEXP'))) {
        var gexpRecord = {
          id: String(item.id),
          expenseDate: item.expenseDate || '',
          category: item.category || '',
          amount: parseFloat(item.amount) || 0,
          description: item.description || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingG = SheetRepo.getRowById('general-expense-trashbin', item.id);
        if (existingG) {
          SheetRepo.updateRow('general-expense-trashbin', item.id, gexpRecord, user);
        } else {
          SheetRepo.insertRow('general-expense-trashbin', gexpRecord, user);
        }
        // Physically remove from active general_expenses sheet so deletion reflects instantly!
        SheetRepo.hardDeleteRow('general_expenses', item.id);
      } else if (category === 'loading-expense' || category === 'expense') {
        var lexpRecord = {
          id: String(item.id),
          expenseDate: item.expenseDate || '',
          category: item.category || '',
          amount: parseFloat(item.amount) || 0,
          description: item.description || '',
          enquiryId: item.enquiryId || '',
          vehicleId: item.vehicleId || '',
          source: item.source || 'MANUAL',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingL = SheetRepo.getRowById('loading-expense-trashbin', item.id);
        if (existingL) {
          SheetRepo.updateRow('loading-expense-trashbin', item.id, lexpRecord, user);
        } else {
          SheetRepo.insertRow('loading-expense-trashbin', lexpRecord, user);
        }
        // Physically remove from active loading_expenses sheet so deletion reflects instantly!
        SheetRepo.hardDeleteRow('loading_expenses', item.id);
      } else if (category === 'daily-report' || category === 'enquiry') {
        var enqRecord = {
          id: String(item.id),
          enquiryNumber: item.enquiryNumber || '',
          transactionNumber: item.transactionNumber || '',
          date: item.date || item.createdAt || '',
          companyId: item.companyId || '',
          clientId: item.clientId || '',
          vehicleNo: item.vehicleNo || item.vehicleNumber || '',
          driverPhone: item.driverPhone || '',
          freightAmount: parseFloat(item.freightAmount) || 0,
          stage: item.stage || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingEnq = SheetRepo.getRowById('daily-report-trashbin', item.id);
        if (existingEnq) {
          SheetRepo.updateRow('daily-report-trashbin', item.id, enqRecord, user);
        } else {
          SheetRepo.insertRow('daily-report-trashbin', enqRecord, user);
        }
        // Physically remove from active enquiries sheet
        SheetRepo.hardDeleteRow('enquiries', item.id);
      } else if (category === 'billing' || category === 'bills') {
        var billRecord = {
          id: String(item.id),
          billNumber: item.billNumber || '',
          financialYear: item.financialYear || '',
          status: item.status || '',
          billingDate: item.billingDate || '',
          companyId: item.companyId || '',
          clientId: item.clientId || '',
          totalAmount: parseFloat(item.totalAmount) || 0,
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingBill = SheetRepo.getRowById('billing-trashbin', item.id);
        if (existingBill) {
          SheetRepo.updateRow('billing-trashbin', item.id, billRecord, user);
        } else {
          SheetRepo.insertRow('billing-trashbin', billRecord, user);
        }
        SheetRepo.hardDeleteRow('bills', item.id);
      } else if (category === 'vendor' || category === 'vendors') {
        var vendorRecord = {
          id: String(item.id),
          name: item.name || '',
          contactPerson: item.contactPerson || '',
          phone: item.phone || '',
          email: item.email || '',
          pan: item.pan || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingVnd = SheetRepo.getRowById('vendor-trashbin', item.id);
        if (existingVnd) {
          SheetRepo.updateRow('vendor-trashbin', item.id, vendorRecord, user);
        } else {
          SheetRepo.insertRow('vendor-trashbin', vendorRecord, user);
        }
        SheetRepo.hardDeleteRow('vendors', item.id);
      } else if (category === 'driver' || category === 'drivers') {
        var drvRecord = {
          id: String(item.id),
          name: item.name || '',
          phone: item.phone || '',
          licenseNumber: item.licenseNumber || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingDrv = SheetRepo.getRowById('driver-trashbin', item.id);
        if (existingDrv) {
          SheetRepo.updateRow('driver-trashbin', item.id, drvRecord, user);
        } else {
          SheetRepo.insertRow('driver-trashbin', drvRecord, user);
        }
        SheetRepo.hardDeleteRow('drivers', item.id);
      } else if (category === 'container' || category === 'containers') {
        var contRecord = {
          id: String(item.id),
          containerNumber: item.containerNumber || '',
          containerType: item.containerType || '',
          deletedAt: now,
          deletedBy: user,
          detailsJson: JSON.stringify(item),
        };
        var existingCont = SheetRepo.getRowById('container-trashbin', item.id);
        if (existingCont) {
          SheetRepo.updateRow('container-trashbin', item.id, contRecord, user);
        } else {
          SheetRepo.insertRow('container-trashbin', contRecord, user);
        }
        SheetRepo.hardDeleteRow('containers', item.id);
      }

      SpreadsheetApp.flush();
      try {
        var c = CacheService.getScriptCache();
        c.remove('TMS_DASHBOARD_SUMMARY');
        c.remove('TRASHBIN_HISTORICAL_SYNCED');
      } catch (ce) {}
    } catch (e) {
      Logger.log('TrashbinModule.recordDeletion error: ' + e.message);
    }
  }

  /**
   * Synchronizes historical soft-deleted items into page-specific trashbins and cleans active sheets.
   */
  function syncHistoricalTrash() {
    try {
      ensureTrashbinSheets();
      var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!spreadsheetId) return;
      var ss = SpreadsheetApp.openById(spreadsheetId);

      // Check for legacy trash sheets (e.g., 'trashbin', 'trash', 'expense-trashbin') and migrate rows
      var legacySheetNames = ['trashbin', 'trash', 'expense-trashbin', 'expenses-trashbin', 'deleted_records', 'deleted_items'];
      legacySheetNames.forEach(function (legacyName) {
        try {
          var legSheet = ss.getSheetByName(legacyName);
          if (legSheet && legSheet.getLastRow() > 1) {
            var legRows = SheetRepo.getAllRows(legacyName, true);
            legRows.forEach(function (row) {
              if (!row.id) return;
              var rowId = String(row.id);
              if (rowId.startsWith('VEH') || row.vehicleNumber) {
                recordDeletion('vehicle', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('GEXP')) {
                recordDeletion('general-expense', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('LEXP') || row.enquiryId || row.source === 'ENQUIRY') {
                recordDeletion('loading-expense', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('ENQ') || row.transactionNumber || row.enquiryNumber) {
                recordDeletion('daily-report', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('BILL') || row.billNumber) {
                recordDeletion('billing', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('VND') || row.pan) {
                recordDeletion('vendor', row, row.deletedBy || 'System');
              } else if (rowId.startsWith('DRV') || row.licenseNumber) {
                recordDeletion('driver', row, row.deletedBy || 'System');
              } else if (row.containerNumber) {
                recordDeletion('container', row, row.deletedBy || 'System');
              }
            });
            // Clear legacy trash sheets so migrated records never cause a loop or re-deletion
            SheetRepo.clearSheetData(legacyName);
          }
        } catch (e) {
          Logger.log('Legacy migration warning for ' + legacyName + ': ' + e.message);
        }
      });

      // 1. General Expenses
      var allG = SheetRepo.getAllRows('general_expenses', true);
      allG.forEach(function (x) {
        var isDel = (x.deletedAt && String(x.deletedAt).trim() !== '' && String(x.deletedAt) !== 'null' && String(x.deletedAt) !== 'undefined') ||
                    String(x.status || '').toUpperCase() === 'DELETED';
        if (isDel) {
          recordDeletion('general-expense', x, x.updatedBy || x.deletedBy || 'USR-001');
        }
      });

      // 2. Loading Expenses
      var allL = SheetRepo.getAllRows('loading_expenses', true);
      allL.forEach(function (x) {
        var isDel = (x.deletedAt && String(x.deletedAt).trim() !== '' && String(x.deletedAt) !== 'null' && String(x.deletedAt) !== 'undefined') ||
                    String(x.status || '').toUpperCase() === 'DELETED';
        if (isDel) {
          recordDeletion('loading-expense', x, x.updatedBy || x.deletedBy || 'USR-001');
        }
      });

      // 3. Vehicles
      var allV = SheetRepo.getAllRows('vehicles', true);
      allV.forEach(function (v) {
        var isDel = (v.deletedAt && String(v.deletedAt).trim() !== '' && String(v.deletedAt) !== 'null' && String(v.deletedAt) !== 'undefined') ||
                    v.active === false || String(v.active).toLowerCase() === 'false' ||
                    String(v.vehicleStatus || '').toUpperCase() === 'INACTIVE';
        if (isDel) {
          recordDeletion('vehicle', v, v.updatedBy || v.deletedBy || 'USR-001');
        }
      });

      // 4. Enquiries / Daily Report
      var allE = SheetRepo.getAllRows('enquiries', true);
      allE.forEach(function (e) {
        var isDel = (e.deletedAt && String(e.deletedAt).trim() !== '' && String(e.deletedAt) !== 'null' && String(e.deletedAt) !== 'undefined') ||
                    String(e.status || '').toUpperCase() === 'DELETED' ||
                    String(e.stage || '').toUpperCase() === 'DELETED';
        if (isDel) {
          recordDeletion('daily-report', e, e.updatedBy || e.deletedBy || 'USR-001');
        }
      });

      // 5. Bills
      var allB = SheetRepo.getAllRows('bills', true);
      allB.forEach(function (b) {
        var isDel = (b.deletedAt && String(b.deletedAt).trim() !== '' && String(b.deletedAt) !== 'null' && String(b.deletedAt) !== 'undefined') ||
                    String(b.status || '').toUpperCase() === 'CANCELLED' ||
                    String(b.status || '').toUpperCase() === 'DELETED';
        if (isDel) {
          recordDeletion('billing', b, b.updatedBy || b.deletedBy || 'USR-001');
        }
      });

      // 6. Vendors
      var allVnd = SheetRepo.getAllRows('vendors', true);
      allVnd.forEach(function (v) {
        var isDel = (v.deletedAt && String(v.deletedAt).trim() !== '' && String(v.deletedAt) !== 'null' && String(v.deletedAt) !== 'undefined') ||
                    v.active === false || String(v.active).toLowerCase() === 'false';
        if (isDel) {
          recordDeletion('vendor', v, v.updatedBy || v.deletedBy || 'USR-001');
        }
      });

      // 7. Drivers
      var allDrv = SheetRepo.getAllRows('drivers', true);
      allDrv.forEach(function (d) {
        var isDel = (d.deletedAt && String(d.deletedAt).trim() !== '' && String(d.deletedAt) !== 'null' && String(d.deletedAt) !== 'undefined') ||
                    d.active === false || String(d.active).toLowerCase() === 'false';
        if (isDel) {
          recordDeletion('driver', d, d.updatedBy || d.deletedBy || 'USR-001');
        }
      });

      // 8. Containers
      var allCont = SheetRepo.getAllRows('containers', true);
      allCont.forEach(function (c) {
        var isDel = (c.deletedAt && String(c.deletedAt).trim() !== '' && String(c.deletedAt) !== 'null' && String(c.deletedAt) !== 'undefined') ||
                    c.active === false || String(c.active).toLowerCase() === 'false';
        if (isDel) {
          recordDeletion('container', c, c.updatedBy || c.deletedBy || 'USR-001');
        }
      });
    } catch (err) {
      Logger.log('TrashbinModule.syncHistoricalTrash warning: ' + err.message);
    }
  }

  /**
   * Lists deleted items organized by page/category tabs.
   */
  function listTrash(params, sessionToken) {
    requireSession(sessionToken);
    params = params || {};

    // Only run multi-sheet historical migration if requested or first run in 1 hour
    var cache = CacheService.getScriptCache();
    var synced = cache.get('TRASHBIN_HISTORICAL_SYNCED');
    if (!synced || params.sync === true || params.sync === 'true') {
      syncHistoricalTrash();
      cache.put('TRASHBIN_HISTORICAL_SYNCED', 'true', 3600);
    }

    var targetCategory = params.category || 'all';
    var search = String(params.search || '').trim().toLowerCase();

    // Map each trashbin sheet
    var vehicleItems = SheetRepo.getAllRows('vehicle-trashbin', true).map(function (v) {
      return {
        id: v.id,
        category: 'vehicle',
        tabName: 'vehicle',
        sheetName: 'vehicle-trashbin',
        sourceSheet: 'vehicles',
        badge: 'Vehicle Fleet',
        title: v.vehicleNumber || v.id,
        subtitle: (v.ownerName ? 'Owner: ' + v.ownerName : '') + (v.vehicleClass ? ' (' + v.vehicleClass + ')' : ''),
        amount: null,
        date: v.fitnessValidUpTo || '',
        deletedAt: v.deletedAt,
        deletedBy: v.deletedBy || 'System',
        raw: v,
      };
    });

    var generalExpenseItems = SheetRepo.getAllRows('general-expense-trashbin', true).map(function (x) {
      return {
        id: x.id,
        category: 'general-expense',
        tabName: 'general-expense',
        sheetName: 'general-expense-trashbin',
        sourceSheet: 'general_expenses',
        badge: 'General Expense',
        title: x.category || x.id,
        subtitle: x.description || 'General Office Expense',
        amount: parseFloat(x.amount) || 0,
        date: x.expenseDate || '',
        deletedAt: x.deletedAt,
        deletedBy: x.deletedBy || 'System',
        raw: x,
      };
    });

    var loadingExpenseItems = SheetRepo.getAllRows('loading-expense-trashbin', true).map(function (x) {
      return {
        id: x.id,
        category: 'loading-expense',
        tabName: 'loading-expense',
        sheetName: 'loading-expense-trashbin',
        sourceSheet: 'loading_expenses',
        badge: 'Loading Expense',
        title: x.category || x.id,
        subtitle: (x.description || '') + (x.vehicleId ? ' | Veh: ' + x.vehicleId : '') + (x.enquiryId ? ' | Enq: ' + x.enquiryId : ''),
        amount: parseFloat(x.amount) || 0,
        date: x.expenseDate || '',
        deletedAt: x.deletedAt,
        deletedBy: x.deletedBy || 'System',
        raw: x,
      };
    });

    var dailyReportItems = SheetRepo.getAllRows('daily-report-trashbin', true).map(function (e) {
      return {
        id: e.id,
        category: 'daily-report',
        tabName: 'daily-report',
        sheetName: 'daily-report-trashbin',
        sourceSheet: 'enquiries',
        badge: 'Daily Report',
        title: e.transactionNumber || e.enquiryNumber || e.id,
        subtitle: (e.vehicleNo ? 'Veh: ' + e.vehicleNo + ' | ' : '') + 'Stage: ' + (e.stage || 'N/A'),
        amount: parseFloat(e.freightAmount) || 0,
        date: e.date || '',
        deletedAt: e.deletedAt,
        deletedBy: e.deletedBy || 'System',
        raw: e,
      };
    });

    var billingItems = SheetRepo.getAllRows('billing-trashbin', true).map(function (b) {
      return {
        id: b.id,
        category: 'billing',
        tabName: 'billing',
        sheetName: 'billing-trashbin',
        sourceSheet: 'bills',
        badge: 'Billing / Invoice',
        title: b.billNumber || b.id,
        subtitle: 'FY: ' + (b.financialYear || '') + ' | Status: ' + (b.status || ''),
        amount: parseFloat(b.totalAmount) || 0,
        date: b.billingDate || '',
        deletedAt: b.deletedAt,
        deletedBy: b.deletedBy || 'System',
        raw: b,
      };
    });

    var vendorItems = SheetRepo.getAllRows('vendor-trashbin', true).map(function (v) {
      return {
        id: v.id,
        category: 'vendor',
        tabName: 'vendor',
        sheetName: 'vendor-trashbin',
        sourceSheet: 'vendors',
        badge: 'Vendor',
        title: v.name || v.id,
        subtitle: (v.contactPerson ? 'Contact: ' + v.contactPerson + ' | ' : '') + (v.phone || ''),
        amount: null,
        date: '',
        deletedAt: v.deletedAt,
        deletedBy: v.deletedBy || 'System',
        raw: v,
      };
    });

    var driverItems = SheetRepo.getAllRows('driver-trashbin', true).map(function (d) {
      return {
        id: d.id,
        category: 'driver',
        tabName: 'driver',
        sheetName: 'driver-trashbin',
        sourceSheet: 'drivers',
        badge: 'Driver',
        title: d.name || d.id,
        subtitle: (d.phone ? 'Phone: ' + d.phone + ' | ' : '') + (d.licenseNumber ? 'DL: ' + d.licenseNumber : ''),
        amount: null,
        date: '',
        deletedAt: d.deletedAt,
        deletedBy: d.deletedBy || 'System',
        raw: d,
      };
    });

    var containerItems = SheetRepo.getAllRows('container-trashbin', true).map(function (c) {
      return {
        id: c.id,
        category: 'container',
        tabName: 'container',
        sheetName: 'container-trashbin',
        sourceSheet: 'containers',
        badge: 'Container',
        title: c.containerNumber || c.id,
        subtitle: 'Type: ' + (c.containerType || 'N/A'),
        amount: null,
        date: '',
        deletedAt: c.deletedAt,
        deletedBy: c.deletedBy || 'System',
        raw: c,
      };
    });

    var counts = {
      total:
        vehicleItems.length +
        generalExpenseItems.length +
        loadingExpenseItems.length +
        dailyReportItems.length +
        billingItems.length +
        vendorItems.length +
        driverItems.length +
        containerItems.length,
      vehicle: vehicleItems.length,
      generalExpense: generalExpenseItems.length,
      loadingExpense: loadingExpenseItems.length,
      dailyReport: dailyReportItems.length,
      billing: billingItems.length,
      vendor: vendorItems.length,
      driver: driverItems.length,
      container: containerItems.length,
    };

    var combined = [];
    if (targetCategory === 'all') {
      combined = combined
        .concat(vehicleItems)
        .concat(generalExpenseItems)
        .concat(loadingExpenseItems)
        .concat(dailyReportItems)
        .concat(billingItems)
        .concat(vendorItems)
        .concat(driverItems)
        .concat(containerItems);
    } else if (targetCategory === 'vehicle') {
      combined = vehicleItems;
    } else if (targetCategory === 'general-expense') {
      combined = generalExpenseItems;
    } else if (targetCategory === 'loading-expense') {
      combined = loadingExpenseItems;
    } else if (targetCategory === 'daily-report') {
      combined = dailyReportItems;
    } else if (targetCategory === 'billing') {
      combined = billingItems;
    } else if (targetCategory === 'vendor') {
      combined = vendorItems;
    } else if (targetCategory === 'driver') {
      combined = driverItems;
    } else if (targetCategory === 'container') {
      combined = containerItems;
    }

    if (search) {
      combined = combined.filter(function (item) {
        var str = (item.title + ' ' + item.subtitle + ' ' + item.id + ' ' + (item.badge || '')).toLowerCase();
        return str.indexOf(search) !== -1;
      });
    }

    combined.sort(function (a, b) {
      var tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      var tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return tB - tA;
    });

    return {
      success: true,
      items: combined,
      counts: counts,
      total: combined.length,
      data: {
        items: combined,
        counts: counts,
        total: combined.length,
      },
    };
  }

  /**
   * Restores an item back into its active sheet and removes it from the trashbin sheet.
   */
  function restore(category, id, sessionToken) {
    var session = requireSession(sessionToken);
    if (!id) throw new Error('Record ID is required for restore.');
    category = String(category || '').toLowerCase();

    function finalizeRestore(recordId) {
      if (recordId) {
        ['trashbin', 'trash', 'expense-trashbin', 'expenses-trashbin', 'deleted_records', 'deleted_items'].forEach(function (leg) {
          try {
            SheetRepo.hardDeleteRow(leg, recordId);
          } catch (e) {}
        });
      }
      SpreadsheetApp.flush();
      try {
        var c = CacheService.getScriptCache();
        c.remove('TMS_DASHBOARD_SUMMARY');
        c.remove('TRASHBIN_HISTORICAL_SYNCED');
      } catch (ce) {}
    }

    // 1. Vehicle
    if (category === 'vehicle' || category === 'vehicles') {
      var vehTrash = SheetRepo.getRowById('vehicle-trashbin', id);
      var origVeh = vehTrash ? (vehTrash.detailsJson ? JSON.parse(vehTrash.detailsJson) : vehTrash) : null;
      if (!origVeh) {
        origVeh = SheetRepo.getRowById('vehicles', id);
      }
      if (!origVeh) throw new Error('Vehicle not found in trashbin or archive: ' + id);

      delete origVeh._rowNumber;
      delete origVeh.deletedAt;
      origVeh.deletedAt = '';
      origVeh.active = true;
      origVeh.vehicleStatus = 'ACTIVE';

      // Insert or update in active vehicles
      var existingActive = SheetRepo.getRowById('vehicles', id);
      if (existingActive) {
        SheetRepo.updateRow('vehicles', id, { deletedAt: '', active: true, vehicleStatus: 'ACTIVE' }, session.userId);
      } else {
        SheetRepo.insertRow('vehicles', origVeh, session.userId);
      }
      SheetRepo.hardDeleteRow('vehicle-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('vehicles', id, 'RESTORE_FROM_TRASH', null, origVeh, session.userId);
      return { success: true, message: 'Vehicle ' + (origVeh.vehicleNumber || id) + ' restored back to active fleet and Excel.' };
    }

    // 2. General Expense
    if (category === 'general-expense' || (category === 'expense' && String(id).startsWith('GEXP'))) {
      var gTrash = SheetRepo.getRowById('general-expense-trashbin', id);
      var origG = gTrash ? (gTrash.detailsJson ? JSON.parse(gTrash.detailsJson) : gTrash) : null;
      if (!origG) {
        origG = SheetRepo.getRowById('general_expenses', id);
      }
      if (!origG) throw new Error('General expense not found in trashbin: ' + id);

      delete origG._rowNumber;
      delete origG.deletedAt;
      origG.deletedAt = '';
      origG.status = 'ACTIVE';
      origG.active = true;

      var existingG = SheetRepo.getRowById('general_expenses', id);
      if (existingG) {
        SheetRepo.updateRow('general_expenses', id, { deletedAt: '', status: 'ACTIVE', active: true }, session.userId);
      } else {
        SheetRepo.insertRow('general_expenses', origG, session.userId);
      }
      SheetRepo.hardDeleteRow('general-expense-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('general_expenses', id, 'RESTORE_FROM_TRASH', null, origG, session.userId);
      return { success: true, message: 'General expense ' + (origG.category || id) + ' restored back to active expenses and Excel.' };
    }

    // 3. Loading Expense
    if (category === 'loading-expense' || category === 'expense') {
      var lTrash = SheetRepo.getRowById('loading-expense-trashbin', id);
      var origL = lTrash ? (lTrash.detailsJson ? JSON.parse(lTrash.detailsJson) : lTrash) : null;
      if (!origL) {
        origL = SheetRepo.getRowById('loading_expenses', id);
      }
      if (!origL) throw new Error('Loading expense not found in trashbin: ' + id);

      delete origL._rowNumber;
      delete origL.deletedAt;
      origL.deletedAt = '';
      origL.status = 'ACTIVE';
      origL.active = true;

      var existingL = SheetRepo.getRowById('loading_expenses', id);
      if (existingL) {
        SheetRepo.updateRow('loading_expenses', id, { deletedAt: '', status: 'ACTIVE', active: true }, session.userId);
      } else {
        SheetRepo.insertRow('loading_expenses', origL, session.userId);
      }
      SheetRepo.hardDeleteRow('loading-expense-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('loading_expenses', id, 'RESTORE_FROM_TRASH', null, origL, session.userId);
      return { success: true, message: 'Loading expense ' + (origL.category || id) + ' restored back to active expenses and Excel.' };
    }

    // 4. Daily Report / Enquiry
    if (category === 'daily-report' || category === 'enquiry' || category === 'enquiries') {
      var enqTrash = SheetRepo.getRowById('daily-report-trashbin', id);
      var origE = enqTrash ? (enqTrash.detailsJson ? JSON.parse(enqTrash.detailsJson) : enqTrash) : null;
      if (!origE) {
        origE = SheetRepo.getRowById('enquiries', id);
      }
      if (!origE) throw new Error('Daily report record not found in trashbin: ' + id);

      delete origE._rowNumber;
      delete origE.deletedAt;
      origE.deletedAt = '';
      if (!origE.stage || origE.stage === 'DELETED') {
        origE.stage = 'ENQUIRY';
      }
      origE.status = 'ACTIVE';
      origE.active = true;

      var existingE = SheetRepo.getRowById('enquiries', id);
      if (existingE) {
        SheetRepo.updateRow('enquiries', id, { deletedAt: '', stage: origE.stage, status: 'ACTIVE', active: true }, session.userId);
      } else {
        SheetRepo.insertRow('enquiries', origE, session.userId);
      }
      SheetRepo.hardDeleteRow('daily-report-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('enquiries', id, 'RESTORE_FROM_TRASH', null, origE, session.userId);
      return { success: true, message: 'Daily report ' + (origE.transactionNumber || id) + ' restored back to active records and Excel.' };
    }

    // 5. Billing
    if (category === 'billing' || category === 'bill' || category === 'bills') {
      var billTrash = SheetRepo.getRowById('billing-trashbin', id);
      var origB = billTrash ? (billTrash.detailsJson ? JSON.parse(billTrash.detailsJson) : billTrash) : null;
      if (!origB) {
        origB = SheetRepo.getRowById('bills', id);
      }
      if (!origB) throw new Error('Bill record not found in trashbin: ' + id);

      delete origB._rowNumber;
      delete origB.deletedAt;
      origB.deletedAt = '';
      if (origB.status === 'DELETED' || origB.status === 'CANCELLED') {
        origB.status = 'PROCESSED';
      }
      origB.active = true;

      var existingB = SheetRepo.getRowById('bills', id);
      if (existingB) {
        SheetRepo.updateRow('bills', id, { deletedAt: '', status: origB.status, active: true }, session.userId);
      } else {
        SheetRepo.insertRow('bills', origB, session.userId);
      }
      SheetRepo.hardDeleteRow('billing-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('bills', id, 'RESTORE_FROM_TRASH', null, origB, session.userId);
      return { success: true, message: 'Bill ' + (origB.billNumber || id) + ' restored back to active billing and Excel.' };
    }

    // 6. Vendor
    if (category === 'vendor' || category === 'vendors') {
      var vndTrash = SheetRepo.getRowById('vendor-trashbin', id);
      var origVnd = vndTrash ? (vndTrash.detailsJson ? JSON.parse(vndTrash.detailsJson) : vndTrash) : null;
      if (!origVnd) {
        origVnd = SheetRepo.getRowById('vendors', id);
      }
      if (!origVnd) throw new Error('Vendor record not found in trashbin: ' + id);

      delete origVnd._rowNumber;
      delete origVnd.deletedAt;
      origVnd.deletedAt = '';
      origVnd.active = true;
      origVnd.status = 'ACTIVE';

      var existingV = SheetRepo.getRowById('vendors', id);
      if (existingV) {
        SheetRepo.updateRow('vendors', id, { deletedAt: '', active: true, status: 'ACTIVE' }, session.userId);
      } else {
        SheetRepo.insertRow('vendors', origVnd, session.userId);
      }
      SheetRepo.hardDeleteRow('vendor-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('vendors', id, 'RESTORE_FROM_TRASH', null, origVnd, session.userId);
      return { success: true, message: 'Vendor ' + (origVnd.name || id) + ' restored back to active vendors and Excel.' };
    }

    // 7. Driver
    if (category === 'driver' || category === 'drivers') {
      var drvTrash = SheetRepo.getRowById('driver-trashbin', id);
      var origDrv = drvTrash ? (drvTrash.detailsJson ? JSON.parse(drvTrash.detailsJson) : drvTrash) : null;
      if (!origDrv) {
        origDrv = SheetRepo.getRowById('drivers', id);
      }
      if (!origDrv) throw new Error('Driver record not found in trashbin: ' + id);

      delete origDrv._rowNumber;
      delete origDrv.deletedAt;
      origDrv.deletedAt = '';
      origDrv.active = true;
      origDrv.status = 'ACTIVE';

      var existingD = SheetRepo.getRowById('drivers', id);
      if (existingD) {
        SheetRepo.updateRow('drivers', id, { deletedAt: '', active: true, status: 'ACTIVE' }, session.userId);
      } else {
        SheetRepo.insertRow('drivers', origDrv, session.userId);
      }
      SheetRepo.hardDeleteRow('driver-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('drivers', id, 'RESTORE_FROM_TRASH', null, origDrv, session.userId);
      return { success: true, message: 'Driver ' + (origDrv.name || id) + ' restored back to active drivers and Excel.' };
    }

    // 8. Container
    if (category === 'container' || category === 'containers') {
      var contTrash = SheetRepo.getRowById('container-trashbin', id);
      var origCont = contTrash ? (contTrash.detailsJson ? JSON.parse(contTrash.detailsJson) : contTrash) : null;
      if (!origCont) {
        origCont = SheetRepo.getRowById('containers', id);
      }
      if (!origCont) throw new Error('Container record not found in trashbin: ' + id);

      delete origCont._rowNumber;
      delete origCont.deletedAt;
      origCont.deletedAt = '';
      origCont.active = true;
      origCont.status = 'ACTIVE';

      var existingC = SheetRepo.getRowById('containers', id);
      if (existingC) {
        SheetRepo.updateRow('containers', id, { deletedAt: '', active: true, status: 'ACTIVE' }, session.userId);
      } else {
        SheetRepo.insertRow('containers', origCont, session.userId);
      }
      SheetRepo.hardDeleteRow('container-trashbin', id);
      finalizeRestore(id);

      writeAuditLog('containers', id, 'RESTORE_FROM_TRASH', null, origCont, session.userId);
      return { success: true, message: 'Container ' + (origCont.containerNumber || id) + ' restored back to active containers and Excel.' };
    }

    throw new Error('Unsupported category: ' + category);
  }

  return {
    ensureTrashbinSheets: ensureTrashbinSheets,
    placeTestingSheetsAtLast: placeTestingSheetsAtLast,
    recordDeletion: recordDeletion,
    syncHistoricalTrash: syncHistoricalTrash,
    listTrash: listTrash,
    restore: restore,
  };
})();
