/**
 * Transport & Logistics Management System (TMS)
 * Phase 11 — Settings & System Audit Module
 */

var SettingsModule = (function () {
  var SETTINGS_SHEET = 'app_settings';
  var AUDIT_SHEET = 'audit_logs';
  var NUMBER_SEQ_SHEET = 'number_sequences';
  var DRIVE_FOLDER_NAME = 'TMS Assets';

  /**
   * Default App Settings Object
   */
  function getDefaultSettings() {
    return {
      id: 'DEFAULT',
      companyName: 'SAIKRISHNA TRANSPORT & LOGISTICS',
      address: 'Plot No. 42, Logistics Park, NH-44, Chennai - 600001',
      phone: '+91 98765 43210',
      email: 'contact@saikrishnalogistics.com',
      gstin: '33AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      sealFileId: '',
      sealViewUrl: '',
      signatureFileId: '',
      signatureViewUrl: '',
      enquiryStartNumber: 10001,
      billStartNumber: 1,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves system settings (creates default row if missing)
   */
  function getSettings() {
    var rows = SheetRepoModule.getAllRows(SETTINGS_SHEET);
    if (!rows || rows.length === 0) {
      var defaultSettings = getDefaultSettings();
      SheetRepoModule.insertRow(SETTINGS_SHEET, defaultSettings);
      return defaultSettings;
    }
    var current = rows[0];
    return {
      id: current.id || 'DEFAULT',
      companyName: current.companyName || '',
      address: current.address || '',
      phone: current.phone || '',
      email: current.email || '',
      gstin: current.gstin || '',
      pan: current.pan || '',
      sealFileId: current.sealFileId || '',
      sealViewUrl: current.sealViewUrl || '',
      signatureFileId: current.signatureFileId || '',
      signatureViewUrl: current.signatureViewUrl || '',
      enquiryStartNumber: parseInt(current.enquiryStartNumber, 10) || 10001,
      billStartNumber: parseInt(current.billStartNumber, 10) || 1,
      updatedAt: current.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Updates company profile & sequence start numbers
   */
  function updateSettings(payload) {
    if (!payload) throw new Error('Settings payload is required.');

    var current = getSettings();
    var oldValue = JSON.stringify(current);

    // Validate sequence numbers
    if (payload.enquiryStartNumber !== undefined) {
      var num = parseInt(payload.enquiryStartNumber, 10);
      if (isNaN(num) || num < 1) {
        throw new Error('Enquiry start number must be a positive integer.');
      }
      current.enquiryStartNumber = num;
    }

    if (payload.billStartNumber !== undefined) {
      var bNum = parseInt(payload.billStartNumber, 10);
      if (isNaN(bNum) || bNum < 1) {
        throw new Error('Bill start number must be a positive integer.');
      }
      current.billStartNumber = bNum;
    }

    if (payload.companyName !== undefined) current.companyName = String(payload.companyName).trim();
    if (payload.address !== undefined) current.address = String(payload.address).trim();
    if (payload.phone !== undefined) current.phone = String(payload.phone).trim();
    if (payload.email !== undefined) current.email = String(payload.email).trim();
    if (payload.gstin !== undefined) current.gstin = String(payload.gstin).trim().toUpperCase();
    if (payload.pan !== undefined) current.pan = String(payload.pan).trim().toUpperCase();

    current.updatedAt = new Date().toISOString();

    SheetRepoModule.updateRow(SETTINGS_SHEET, current.id, current);
    AuditModule.writeAuditLog('settings', current.id, 'UPDATE_SETTINGS', oldValue, JSON.stringify(current));

    return current;
  }

  /**
   * Gets or creates the Google Drive folder for TMS Assets
   */
  function getDriveAssetsFolder() {
    if (typeof DriveApp === 'undefined') return null;
    try {
      var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
      if (folders.hasNext()) return folders.next();
      return DriveApp.createFolder(DRIVE_FOLDER_NAME);
    } catch (e) {
      Logger.log('DriveApp notice: ' + e.message);
      return null;
    }
  }

  /**
   * Uploads base64 seal image
   */
  function uploadSeal(payload) {
    if (!payload || !payload.base64Data) {
      throw new Error('Image base64Data is required for seal upload.');
    }
    var current = getSettings();
    var fileId = 'SEAL_' + Date.now();
    var viewUrl = 'data:' + (payload.contentType || 'image/png') + ';base64,' + payload.base64Data;

    try {
      var folder = getDriveAssetsFolder();
      if (folder && typeof Utilities !== 'undefined') {
        var bytes = Utilities.base64Decode(payload.base64Data);
        var blob = Utilities.newBlob(bytes, payload.contentType || 'image/png', 'company_seal.png');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileId = file.getId();
        viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
      }
    } catch (err) {
      Logger.log('Drive upload fallback for seal: ' + err.message);
    }

    current.sealFileId = fileId;
    current.sealViewUrl = viewUrl;
    current.updatedAt = new Date().toISOString();

    SheetRepoModule.updateRow(SETTINGS_SHEET, current.id, current);
    AuditModule.writeAuditLog('settings', current.id, 'UPLOAD_SEAL', '', fileId);

    return current;
  }

  /**
   * Removes company seal image
   */
  function removeSeal() {
    var current = getSettings();
    current.sealFileId = '';
    current.sealViewUrl = '';
    current.updatedAt = new Date().toISOString();

    SheetRepoModule.updateRow(SETTINGS_SHEET, current.id, current);
    AuditModule.writeAuditLog('settings', current.id, 'REMOVE_SEAL', '', '');

    return current;
  }

  /**
   * Uploads base64 authorized signature image
   */
  function uploadSignature(payload) {
    if (!payload || !payload.base64Data) {
      throw new Error('Image base64Data is required for signature upload.');
    }
    var current = getSettings();
    var fileId = 'SIG_' + Date.now();
    var viewUrl = 'data:' + (payload.contentType || 'image/png') + ';base64,' + payload.base64Data;

    try {
      var folder = getDriveAssetsFolder();
      if (folder && typeof Utilities !== 'undefined') {
        var bytes = Utilities.base64Decode(payload.base64Data);
        var blob = Utilities.newBlob(bytes, payload.contentType || 'image/png', 'authorized_signature.png');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileId = file.getId();
        viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
      }
    } catch (err) {
      Logger.log('Drive upload fallback for signature: ' + err.message);
    }

    current.signatureFileId = fileId;
    current.signatureViewUrl = viewUrl;
    current.updatedAt = new Date().toISOString();

    SheetRepoModule.updateRow(SETTINGS_SHEET, current.id, current);
    AuditModule.writeAuditLog('settings', current.id, 'UPLOAD_SIGNATURE', '', fileId);

    return current;
  }

  /**
   * Removes authorized signature image
   */
  function removeSignature() {
    var current = getSettings();
    current.signatureFileId = '';
    current.signatureViewUrl = '';
    current.updatedAt = new Date().toISOString();

    SheetRepoModule.updateRow(SETTINGS_SHEET, current.id, current);
    AuditModule.writeAuditLog('settings', current.id, 'REMOVE_SIGNATURE', '', '');

    return current;
  }

  /**
   * Previews upcoming bill number for a financial year
   */
  function previewNextBillNumber(dateStr) {
    var fy = FinancialYearModule.getFinancialYear(dateStr || new Date());
    var settings = getSettings();

    var seqRows = SheetRepoModule.getAllRows(NUMBER_SEQ_SHEET);
    var seqKey = 'bill_' + fy;
    var currentSeq = 0;

    for (var i = 0; i < seqRows.length; i++) {
      if (seqRows[i].sequenceKey === seqKey) {
        currentSeq = parseInt(seqRows[i].currentValue, 10) || 0;
        break;
      }
    }

    var nextSeq = currentSeq > 0 ? currentSeq + 1 : (settings.billStartNumber || 1);
    var nextBillNumber = nextSeq + '/' + fy;

    return {
      financialYear: fy,
      nextSeq: nextSeq,
      nextBillNumber: nextBillNumber
    };
  }

  /**
   * Queries audit logs with pagination and filters
   */
  function listAuditLogs(params) {
    params = params || {};
    var rows = SheetRepoModule.getAllRows(AUDIT_SHEET);

    // Apply entity filter
    if (params.entity) {
      rows = rows.filter(function (r) {
        return (r.entity || '').toLowerCase() === String(params.entity).toLowerCase();
      });
    }

    // Apply search filter (action, entity, entityId)
    if (params.search) {
      var query = String(params.search).toLowerCase();
      rows = rows.filter(function (r) {
        return (
          (r.action || '').toLowerCase().indexOf(query) !== -1 ||
          (r.entity || '').toLowerCase().indexOf(query) !== -1 ||
          (r.entityId || '').toLowerCase().indexOf(query) !== -1
        );
      });
    }

    // Sort newest first
    rows.sort(function (a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // Pagination
    var page = parseInt(params.page, 10) || 1;
    var limit = parseInt(params.limit, 10) || 20;
    var total = rows.length;
    var startIndex = (page - 1) * limit;
    var paginated = rows.slice(startIndex, startIndex + limit);

    return {
      items: paginated,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  return {
    getSettings: getSettings,
    updateSettings: updateSettings,
    uploadSeal: uploadSeal,
    removeSeal: removeSeal,
    uploadSignature: uploadSignature,
    removeSignature: removeSignature,
    previewNextBillNumber: previewNextBillNumber,
    listAuditLogs: listAuditLogs
  };
})();

if (typeof module !== 'undefined') {
  module.exports = SettingsModule;
}
