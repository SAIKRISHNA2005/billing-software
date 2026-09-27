/**
 * Transport & Logistics Management System (TMS)
 * Live Reporting & Synchronization System
 * Workbooks:
 * 1. Daily Report (Single sheet, 23 standard columns + hidden ID)
 * 2. Client-Wise Report (Dynamic sheet per CLIENT, 23 standard columns + hidden ID)
 * 3. Processed Bills (12 columns + hidden ID)
 */

var ReportingSyncModule = (function () {
  var DAILY_HEADERS = [
    'Creation Date',
    'Booking Date',
    'Company Name',
    'Type',
    'Client Name',
    'Billing Number',
    'Booking Number',
    'Feet',
    'Container Number',
    'Seal Number',
    'Vehicle Number',
    'Driver Number',
    'Diesel',
    'Advance',
    'Company In',
    'Company Out',
    'Print In',
    'Print Out',
    'Port In',
    'Port Out',
    'Movement Status',
    'Shipping Status',
    'Comments',
    '_enquiryId' // Column 24: Unique identifier for deterministic upsert matching
  ];

  var PROCESSED_BILLS_HEADERS = [
    'Bill Number',
    'Company Name',
    'Client Name',
    'Billing Date',
    'Financial Year',
    'Subtotal',
    'Tax Amount',
    'Total Amount',
    'Paid Amount',
    'Outstanding Amount',
    'Status',
    'Processed At',
    '_billId' // Column 13: Unique identifier for deterministic upsert matching
  ];

  /**
   * Cleans name for use as a valid Excel/Google Sheet tab name
   */
  function sanitizeSheetName(name) {
    if (!name || typeof name !== 'string') return 'General';
    var clean = name.replace(/[\\/?*\[\]:']/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 30) clean = clean.substring(0, 30).trim();
    return clean || 'General';
  }

  function safeDateStr(val) {
    if (!val) return '';
    if (val instanceof Date) {
      var y = val.getFullYear();
      var m = ('0' + (val.getMonth() + 1)).slice(-2);
      var d = ('0' + val.getDate()).slice(-2);
      return y + '-' + m + '-' + d;
    }
    var str = String(val);
    if (str.indexOf('T') !== -1) return str.substring(0, 10);
    return str.length > 10 ? str.substring(0, 10) : str;
  }

  function getSpreadsheet(propName, payloadId) {
    var id = (payloadId || '').trim();
    if (!id) {
      id = (PropertiesService.getScriptProperties().getProperty(propName) || '').trim();
    }
    if (!id) {
      if (propName === 'DAILY_REPORT_SPREADSHEET_ID') id = '1nNV4hNa6C9AV929jrWP3uT_0wXXH4Cl-ESJ1LpZ6Jio';
      if (propName === 'COMPANY_REPORT_SPREADSHEET_ID') id = '1yTJ8wkzCP0zkYfwtBh0xChEfL7GKk5jOGzl2UmPYYHk';
      if (propName === 'PROCESSED_BILLS_SPREADSHEET_ID') id = '1ZhoTFFOARxJiTtnEKyuljFmgTmMWXdxTkVCkuBsH1Ug';
    }
    if (!id) {
      throw new Error('Spreadsheet ID for ' + propName + ' is not configured.');
    }
    return SpreadsheetApp.openById(id);
  }

  function applyHeaderStyles(sheet, headers) {
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground('#1F4E78');
    range.setFontColor('#FFFFFF');
    range.setFontWeight('bold');
    range.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    // Hide the last ID column so report remains clean for end users
    try {
      sheet.hideColumns(headers.length);
    } catch (e) {}
  }

  function formatRowData(r) {
    return [
      r.creationDate || '',
      r.bookingDate || '',
      r.companyName || '',
      r.loadingType || r.type || 'Import',
      r.clientName || '',
      r.billingNumber || '-',
      r.bookingNumber || r.transactionNo || r.id || '',
      r.feet || '40 FT',
      r.containerNumber || '',
      r.sealNumber || '-',
      r.vehicleNumber || '',
      r.driverNumber || '-',
      Number(r.diesel) || 0,
      Number(r.advance) || 0,
      r.companyIn || '',
      r.companyOut || '',
      r.printIn || '',
      r.printOut || '',
      r.portIn || '',
      r.portOut || '',
      r.movementStatus || 'NOT_MOVED',
      r.shippingStatus || 'PENDING',
      r.comments || '',
      r.id || r.enquiryId || ''
    ];
  }

  function formatBillRowData(b) {
    return [
      b.billNumber || b.id || '',
      b.companyName || '',
      b.clientName || '',
      safeDateStr(b.billingDate),
      b.financialYear || '',
      Number(b.subtotal) || 0,
      Number(b.taxAmount) || 0,
      Number(b.totalAmount) || 0,
      Number(b.paidAmount) || 0,
      Number(b.outstandingAmount) || 0,
      b.status || 'PROCESSED',
      safeDateStr(b.processedAt || b.createdAt),
      b.id || b.billId || ''
    ];
  }

  /**
   * WORKBOOK 1: Upsert Daily Report Row
   */
  function syncDailyRow(payload) {
    var ss = getSpreadsheet('DAILY_REPORT_SPREADSHEET_ID', payload.dailySpreadsheetId);
    var sheet = ss.getSheetByName('Daily Report');
    if (!sheet) {
      sheet = ss.insertSheet('Daily Report', 0);
    }

    if (sheet.getLastRow() === 0) {
      applyHeaderStyles(sheet, DAILY_HEADERS);
    }

    var enquiryId = payload.id || payload.enquiryId;
    if (!enquiryId) throw new Error('Missing enquiryId for Daily Report sync');

    var rowValues = formatRowData(payload);
    var lastRow = sheet.getLastRow();
    var matchRowIndex = -1;

    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 24, lastRow - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (String(idValues[i][0]) === String(enquiryId)) {
          matchRowIndex = i + 2;
          break;
        }
      }
    }

    if (matchRowIndex > 1) {
      sheet.getRange(matchRowIndex, 1, 1, DAILY_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return { success: true, action: matchRowIndex > 1 ? 'UPDATED' : 'INSERTED', enquiryId: enquiryId };
  }

  /**
   * WORKBOOK 1: Delete Daily Report Row
   */
  function deleteDailyRow(payload) {
    var ss = getSpreadsheet('DAILY_REPORT_SPREADSHEET_ID', payload.dailySpreadsheetId);
    var sheet = ss.getSheetByName('Daily Report');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, action: 'NOOP' };

    var enquiryId = payload.id || payload.enquiryId;
    var lastRow = sheet.getLastRow();
    var idValues = sheet.getRange(2, 24, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0]) === String(enquiryId)) {
        sheet.deleteRow(i + 2);
        return { success: true, action: 'DELETED', enquiryId: enquiryId };
      }
    }
    return { success: true, action: 'NOT_FOUND' };
  }

  /**
   * WORKBOOK 2: Ensure Client Sheet Exists
   */
  function ensureClientSheet(ss, clientName) {
    var sheetName = sanitizeSheetName(clientName);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      applyHeaderStyles(sheet, DAILY_HEADERS);
    } else if (sheet.getLastRow() === 0) {
      applyHeaderStyles(sheet, DAILY_HEADERS);
    }
    return sheet;
  }

  /**
   * WORKBOOK 2: Upsert Client-Wise Row
   */
  function syncClientRow(payload) {
    var ss = getSpreadsheet('COMPANY_REPORT_SPREADSHEET_ID', payload.companySpreadsheetId || payload.clientSpreadsheetId);
    var targetClientName = payload.clientName || 'General';
    var sheet = ensureClientSheet(ss, targetClientName);

    var enquiryId = payload.id || payload.enquiryId;
    if (!enquiryId) throw new Error('Missing enquiryId for Client Report sync');

    // If client changed from oldClientName, remove row from old client sheet
    if (payload.oldClientName && sanitizeSheetName(payload.oldClientName) !== sanitizeSheetName(targetClientName)) {
      var oldSheet = ss.getSheetByName(sanitizeSheetName(payload.oldClientName));
      if (oldSheet && oldSheet.getLastRow() > 1) {
        var oldIds = oldSheet.getRange(2, 24, oldSheet.getLastRow() - 1, 1).getValues();
        for (var k = 0; k < oldIds.length; k++) {
          if (String(oldIds[k][0]) === String(enquiryId)) {
            oldSheet.deleteRow(k + 2);
            break;
          }
        }
      }
    }

    var rowValues = formatRowData(payload);
    var lastRow = sheet.getLastRow();
    var matchRowIndex = -1;

    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 24, lastRow - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (String(idValues[i][0]) === String(enquiryId)) {
          matchRowIndex = i + 2;
          break;
        }
      }
    }

    if (matchRowIndex > 1) {
      sheet.getRange(matchRowIndex, 1, 1, DAILY_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      success: true,
      action: matchRowIndex > 1 ? 'UPDATED' : 'INSERTED',
      client: sanitizeSheetName(targetClientName),
      enquiryId: enquiryId
    };
  }

  /**
   * WORKBOOK 2: Delete Client-Wise Row
   */
  function deleteClientRow(payload) {
    var ss = getSpreadsheet('COMPANY_REPORT_SPREADSHEET_ID', payload.companySpreadsheetId || payload.clientSpreadsheetId);
    var targetClientName = payload.clientName;
    var enquiryId = payload.id || payload.enquiryId;

    var sheetsToSearch = [];
    if (targetClientName) {
      var s = ss.getSheetByName(sanitizeSheetName(targetClientName));
      if (s) sheetsToSearch.push(s);
    } else {
      sheetsToSearch = ss.getSheets();
    }

    for (var sIdx = 0; sIdx < sheetsToSearch.length; sIdx++) {
      var sh = sheetsToSearch[sIdx];
      var lastRow = sh.getLastRow();
      if (lastRow > 1) {
        var ids = sh.getRange(2, 24, lastRow - 1, 1).getValues();
        for (var r = 0; r < ids.length; r++) {
          if (String(ids[r][0]) === String(enquiryId)) {
            sh.deleteRow(r + 2);
            return { success: true, action: 'DELETED', client: sh.getName(), enquiryId: enquiryId };
          }
        }
      }
    }
    return { success: true, action: 'NOT_FOUND' };
  }

  /**
   * WORKBOOK 3: Upsert Processed Bill Row
   */
  function syncBillRow(payload) {
    var ss = getSpreadsheet('PROCESSED_BILLS_SPREADSHEET_ID', payload.processedBillsSpreadsheetId);
    var sheet = ss.getSheetByName('Processed Bills');
    if (!sheet) {
      sheet = ss.insertSheet('Processed Bills', 0);
    }

    if (sheet.getLastRow() === 0) {
      applyHeaderStyles(sheet, PROCESSED_BILLS_HEADERS);
    }

    var billId = payload.id || payload.billId;
    var billNumber = payload.billNumber;
    if (!billId && !billNumber) throw new Error('Missing billId / billNumber for Processed Bills sync');

    var rowValues = formatBillRowData(payload);
    var lastRow = sheet.getLastRow();
    var matchRowIndex = -1;

    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
      var numValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        var rId = String(idValues[i][0]);
        var rNum = String(numValues[i][0]);
        if ((billId && rId === String(billId)) || (billNumber && rNum === String(billNumber))) {
          matchRowIndex = i + 2;
          break;
        }
      }
    }

    if (matchRowIndex > 1) {
      sheet.getRange(matchRowIndex, 1, 1, PROCESSED_BILLS_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      success: true,
      action: matchRowIndex > 1 ? 'UPDATED' : 'INSERTED',
      billNumber: billNumber,
      billId: billId
    };
  }

  /**
   * WORKBOOK 3: Delete Processed Bill Row
   */
  function deleteBillRow(payload) {
    var ss = getSpreadsheet('PROCESSED_BILLS_SPREADSHEET_ID', payload.processedBillsSpreadsheetId);
    var sheet = ss.getSheetByName('Processed Bills');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, action: 'NOOP' };

    var billId = payload.id || payload.billId;
    var billNumber = payload.billNumber;
    var lastRow = sheet.getLastRow();
    var idValues = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
    var numValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (var i = 0; i < idValues.length; i++) {
      var rId = String(idValues[i][0]);
      var rNum = String(numValues[i][0]);
      if ((billId && rId === String(billId)) || (billNumber && rNum === String(billNumber))) {
        sheet.deleteRow(i + 2);
        return { success: true, action: 'DELETED', billNumber: billNumber, billId: billId };
      }
    }
    return { success: true, action: 'NOT_FOUND' };
  }

  /**
   * INITIAL FULL SYNC
   * Reads all master data and populates all 3 workbooks
   * Note: Workbook 2 is strictly CLIENT-WISE (one dynamic sheet per client)
   */
  function initialFullSync(payload) {
    payload = payload || {};

    // 1. Fetch all data from master database sheet
    var enquiries = SheetRepo.getAllRows('enquiries').filter(function (e) { return !e.deletedAt; });
    var movements = SheetRepo.getAllRows('movements').filter(function (m) { return !m.deletedAt; });
    var companies = SheetRepo.getAllRows('companies').filter(function (c) { return !c.deletedAt; });
    var clients = SheetRepo.getAllRows('clients').filter(function (c) { return !c.deletedAt; });
    var vehicles = SheetRepo.getAllRows('vehicles');
    var drivers = SheetRepo.getAllRows('drivers');
    var containers = SheetRepo.getAllRows('containers');
    var bills = SheetRepo.getAllRows('bills').filter(function (b) { return !b.deletedAt; });

    var companyMap = {};
    companies.forEach(function (c) { companyMap[c.id] = c.name; });
    var clientMap = {};
    clients.forEach(function (c) { clientMap[c.id] = c.name; });
    var vehicleMap = {};
    vehicles.forEach(function (v) { vehicleMap[v.id] = v.vehicleNumber; });
    var driverMap = {};
    drivers.forEach(function (d) { driverMap[d.id] = d.phone || d.name; });
    var containerMap = {};
    containers.forEach(function (c) { containerMap[c.id] = c; });
    var movMap = {};
    movements.forEach(function (m) { movMap[m.enquiryId] = m; });
    var billMap = {};
    bills.forEach(function (b) { billMap[b.id] = b.billNumber; });

    // Format all enquiries for reporting
    var mappedEnquiries = enquiries.map(function (e) {
      var mov = movMap[e.id] || {};
      var con = containerMap[e.containerId] || {};
      return {
        id: e.id,
        creationDate: safeDateStr(e.createdAt || e.date),
        bookingDate: safeDateStr(e.bookingDate || e.date || e.createdAt),
        companyName: companyMap[e.companyId] || e.companyId || 'General',
        loadingType: e.loadingType || 'Import',
        clientName: clientMap[e.clientId] || e.clientId || 'General Client',
        billingNumber: billMap[e.billId] || e.billNumber || e.billId || '-',
        bookingNumber: e.bookingNumber || e.transactionNo || e.transactionNumber || e.id || '',
        feet: e.containerSize || con.containerType || '40 FT',
        containerNumber: con.containerNumber || e.containerNo || e.containerNumber || '',
        sealNumber: e.sealNumber || '-',
        vehicleNumber: vehicleMap[e.vehicleId] || e.vehicleNo || e.vehicleNumber || '',
        driverNumber: driverMap[e.driverId] || e.driverPhone || e.driverInfo || '-',
        diesel: Number(e.dieselAmount) || 0,
        advance: Number(e.advanceAmount) || 0,
        companyIn: mov.companyInTime || '',
        companyOut: mov.companyOutTime || '',
        printIn: mov.printInTime || '',
        printOut: mov.printOutTime || '',
        portIn: mov.portInTime || '',
        portOut: mov.portOutTime || '',
        movementStatus: mov.movementStatus || 'NOT_MOVED',
        shippingStatus: mov.shippingStatus || 'PENDING',
        comments: e.comments || e.remarks || ''
      };
    });

    // --- WORKBOOK 1: Daily Report Full Sync ---
    var dailySS = getSpreadsheet('DAILY_REPORT_SPREADSHEET_ID', payload.dailySpreadsheetId);
    var dailySheet = dailySS.getSheetByName('Daily Report');
    if (!dailySheet) dailySheet = dailySS.insertSheet('Daily Report', 0);
    dailySheet.clear();
    applyHeaderStyles(dailySheet, DAILY_HEADERS);
    if (mappedEnquiries.length > 0) {
      var dailyRows = mappedEnquiries.map(formatRowData);
      dailySheet.getRange(2, 1, dailyRows.length, DAILY_HEADERS.length).setValues(dailyRows);
    }

    // --- WORKBOOK 2: Client-Wise Full Sync ---
    var clientSS = getSpreadsheet('COMPANY_REPORT_SPREADSHEET_ID', payload.companySpreadsheetId || payload.clientSpreadsheetId);
    
    // 1. Create a temporary sheet so we can delete old company-named sheets cleanly
    var tempSheet = clientSS.getSheetByName('__temp_init__');
    if (!tempSheet) tempSheet = clientSS.insertSheet('__temp_init__');

    // 2. Delete all existing sheets (removes previous company-named sheets)
    var existingSheets = clientSS.getSheets();
    for (var es = 0; es < existingSheets.length; es++) {
      if (existingSheets[es].getName() !== '__temp_init__') {
        try {
          clientSS.deleteSheet(existingSheets[es]);
        } catch (delErr) {}
      }
    }

    // 3. Group records by CLIENT name
    var clientGroups = {};
    clients.forEach(function (c) {
      var sName = sanitizeSheetName(c.name);
      clientGroups[sName] = [];
    });
    mappedEnquiries.forEach(function (r) {
      var sName = sanitizeSheetName(r.clientName);
      if (!clientGroups[sName]) clientGroups[sName] = [];
      clientGroups[sName].push(r);
    });

    // If no clients exist, create at least 'General Client'
    if (Object.keys(clientGroups).length === 0) {
      clientGroups['General Client'] = [];
    }

    var createdClientSheets = [];
    Object.keys(clientGroups).forEach(function (sName) {
      var clSheet = clientSS.insertSheet(sName);
      applyHeaderStyles(clSheet, DAILY_HEADERS);
      var recs = clientGroups[sName];
      if (recs && recs.length > 0) {
        var clRows = recs.map(formatRowData);
        clSheet.getRange(2, 1, clRows.length, DAILY_HEADERS.length).setValues(clRows);
      }
      createdClientSheets.push(sName);
    });

    // 4. Remove the temporary sheet
    try {
      clientSS.deleteSheet(tempSheet);
    } catch (e) {}

    // --- WORKBOOK 3: Processed Bills Full Sync ---
    var billsSS = getSpreadsheet('PROCESSED_BILLS_SPREADSHEET_ID', payload.processedBillsSpreadsheetId);
    var billsSheet = billsSS.getSheetByName('Processed Bills');
    if (!billsSheet) billsSheet = billsSS.insertSheet('Processed Bills', 0);
    billsSheet.clear();
    applyHeaderStyles(billsSheet, PROCESSED_BILLS_HEADERS);

    var processedBills = bills.filter(function (b) {
      return (b.status || '').toUpperCase() === 'PROCESSED';
    });

    var mappedBills = processedBills.map(function (b) {
      var tot = Number(b.totalAmount) || 0;
      var paid = Number(b.paidAmount) || 0;
      var sub = Number(b.subtotal);
      if (isNaN(sub) || sub === 0) sub = tot;
      var out = Number(
        b.outstandingAmount !== undefined && b.outstandingAmount !== ''
          ? b.outstandingAmount
          : b.pendingAmount !== undefined && b.pendingAmount !== ''
          ? b.pendingAmount
          : Math.max(0, tot - paid)
      );

      return {
        id: b.id,
        billNumber: b.billNumber || b.id,
        companyName: companyMap[b.companyId] || b.companyName || b.companyId || '',
        clientName: clientMap[b.clientId] || b.clientName || b.clientId || '',
        billingDate: safeDateStr(b.billingDate),
        financialYear: b.financialYear || '',
        subtotal: sub,
        taxAmount: Number(b.taxAmount) || 0,
        totalAmount: tot,
        paidAmount: paid,
        outstandingAmount: out,
        status: 'PROCESSED',
        processedAt: safeDateStr(b.processedAt || b.createdAt)
      };
    });

    if (mappedBills.length > 0) {
      var billRows = mappedBills.map(formatBillRowData);
      billsSheet.getRange(2, 1, billRows.length, PROCESSED_BILLS_HEADERS.length).setValues(billRows);
    }

    try {
      var defaultBillSheet = billsSS.getSheetByName('Sheet1');
      if (defaultBillSheet && billsSS.getSheets().length > 1) {
        billsSS.deleteSheet(defaultBillSheet);
      }
    } catch (e) {}

    return {
      success: true,
      data: {
        dailyRecordsCount: mappedEnquiries.length,
        clientSheetsCount: createdClientSheets.length,
        clientSheets: createdClientSheets,
        processedBillsCount: mappedBills.length
      },
      message: 'Initial full sync completed successfully: Workbook 2 is now Client-Wise'
    };
  }

  return {
    syncDailyRow: syncDailyRow,
    deleteDailyRow: deleteDailyRow,
    syncClientRow: syncClientRow,
    deleteClientRow: deleteClientRow,
    // Aliases for company naming compatibility
    syncCompanyRow: syncClientRow,
    deleteCompanyRow: deleteClientRow,
    ensureClientSheet: function (payload) {
      var ss = getSpreadsheet('COMPANY_REPORT_SPREADSHEET_ID', payload.companySpreadsheetId || payload.clientSpreadsheetId);
      ensureClientSheet(ss, payload.clientName || payload.companyName);
      return { success: true, sheetName: sanitizeSheetName(payload.clientName || payload.companyName) };
    },
    ensureCompanySheet: function (payload) {
      var ss = getSpreadsheet('COMPANY_REPORT_SPREADSHEET_ID', payload.companySpreadsheetId || payload.clientSpreadsheetId);
      ensureClientSheet(ss, payload.clientName || payload.companyName);
      return { success: true, sheetName: sanitizeSheetName(payload.clientName || payload.companyName) };
    },
    syncBillRow: syncBillRow,
    deleteBillRow: deleteBillRow,
    initialFullSync: initialFullSync
  };
})();
