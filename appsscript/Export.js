/**
 * Transport & Logistics Management System (TMS)
 * Phase 17 — Excel & Report Exports Module
 */

var ExportModule = (function () {

  /**
   * Fetches the entire master Google Spreadsheet as .xlsx base64 string
   */
  function exportMasterXlsx() {
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID script property is not configured.');
    }

    var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
    var options = {
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error('Google Sheets export failed with status code ' + response.getResponseCode());
    }

    var bytes = response.getBlob().getBytes();
    var base64Data = Utilities.base64Encode(bytes);

    AuditModule.writeAuditLog('export', spreadsheetId, 'EXPORT_MASTER_XLSX', '', 'Exported .xlsx snapshot');

    return {
      filename: 'TMS_Master_Database_' + new Date().toISOString().substring(0, 10) + '.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64Data: base64Data
    };
  }

  /**
   * Generates CSV report data string for any entity or report
   */
  function exportReportCsv(params) {
    params = params || {};
    var reportType = params.report || 'enquiries';
    var csvContent = '';
    var filename = 'TMS_Report_' + reportType + '_' + new Date().toISOString().substring(0, 10) + '.csv';

    if (reportType === 'enquiries') {
      var enquiries = SheetRepoModule.getAllRows('enquiries').filter(function (e) { return !e.deletedAt; });
      var headers = ['Enquiry ID', 'Transaction No', 'Creation Date', 'Company ID', 'Client ID', 'Type', 'Vehicle No', 'Container No', 'Driver Phone', 'Stage', 'Freight Amount', 'Halting Amount'];
      csvContent = headers.join(',') + '\n';
      enquiries.forEach(function (e) {
        var row = [
          e.id || '',
          e.transactionNo || '',
          e.createdAt || '',
          e.companyId || '',
          e.clientId || '',
          e.loadingType || '',
          e.vehicleNo || '',
          e.containerNo || '',
          e.driverPhone || '',
          e.stage || '',
          e.freightAmount || 0,
          e.haltingAmount || 0
        ];
        csvContent += row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',') + '\n';
      });
    } else if (reportType === 'bills') {
      var bills = SheetRepoModule.getAllRows('bills').filter(function (b) { return !b.deletedAt; });
      var bHeaders = ['Bill ID', 'Bill Number', 'Sequence', 'Financial Year', 'Status', 'Billing Date', 'Company ID', 'Client ID', 'Total Amount', 'Processed At'];
      csvContent = bHeaders.join(',') + '\n';
      bills.forEach(function (b) {
        var bRow = [
          b.id || '',
          b.billNumber || '',
          b.billSeq || 0,
          b.financialYear || '',
          b.status || '',
          b.billingDate || '',
          b.companyId || '',
          b.clientId || '',
          b.totalAmount || 0,
          b.processedAt || ''
        ];
        csvContent += bRow.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',') + '\n';
      });
    } else {
      csvContent = 'Report Type,Exported Timestamp\n' + reportType + ',' + new Date().toISOString() + '\n';
    }

    AuditModule.writeAuditLog('export', reportType, 'EXPORT_REPORT_CSV', '', filename);

    return {
      filename: filename,
      contentType: 'text/csv',
      csvData: csvContent
    };
  }

  return {
    exportMasterXlsx: exportMasterXlsx,
    exportReportCsv: exportReportCsv
  };
})();

if (typeof module !== 'undefined') {
  module.exports = ExportModule;
}
