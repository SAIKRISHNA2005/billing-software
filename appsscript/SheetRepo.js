/**
 * Transport & Logistics Management System (TMS)
 * Phase 3 - Generic Sheet Data Access Layer
 * STRICT RULES: R13 (LockService for number_sequences), R14 (Batch getValues/setValues, no cell-by-cell loops).
 */

const SheetRepo = {
  /**
   * Helper to get Google Sheet by tab name
   */
  getSheet(sheetName) {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID is not configured in Script Properties.');
    }
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: "' + sheetName + '". Please run createAllSheets() first.');
    }
    return sheet;
  },

  /**
   * Reads all rows from a sheet as an array of objects keyed by header names.
   * Performs ONE single batched getValues() call.
   */
  getAllRows(sheetName, includeDeleted) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2 || lastCol < 1) {
      return [];
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0];
    const rows = [];

    for (let r = 1; r < data.length; r++) {
      const rowData = data[r];
      const record = { _rowNumber: r + 1 };

      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        if (header) {
          record[header] = rowData[c];
        }
      }

      // Filter soft deleted rows unless includeDeleted is explicitly true
      if (!includeDeleted && record.deletedAt) {
        continue;
      }

      rows.push(record);
    }

    return rows;
  },

  /**
   * Finds a single record by its ID.
   */
  getRowById(sheetName, id) {
    const all = this.getAllRows(sheetName, true);
    const idKey = sheetName === 'number_sequences' ? 'sequenceKey' : 'id';
    return all.find((item) => String(item[idKey]) === String(id)) || null;
  },

  /**
   * Inserts a new record into a sheet.
   * Uses LockService if touching number_sequences.
   * Performs batch write.
   */
  insertRow(sheetName, obj, createdBy) {
    let lock = null;
    if (sheetName === 'number_sequences') {
      lock = LockService.getScriptLock();
      lock.waitLock(30000); // 30s timeout
    }

    try {
      const sheet = this.getSheet(sheetName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Auto-assign ID if missing and not number_sequences
      if (sheetName !== 'number_sequences' && !obj.id) {
        obj.id = Utilities.getUuid();
      }

      const now = new Date().toISOString();
      if (!obj.createdAt && headers.includes('createdAt')) {
        obj.createdAt = now;
      }
      if (!obj.updatedAt && headers.includes('updatedAt')) {
        obj.updatedAt = now;
      }
      if (createdBy && headers.includes('createdBy') && !obj.createdBy) {
        obj.createdBy = createdBy;
      }

      const rowValues = headers.map((header) => {
        return obj[header] !== undefined ? obj[header] : '';
      });

      sheet.getRange(sheet.getLastRow() + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return obj;
    } finally {
      if (lock) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Updates an existing record by ID or sequenceKey with a partial patch.
   * Uses LockService if touching number_sequences.
   * Performs batch read and single row batch write.
   */
  updateRow(sheetName, id, patch, updatedBy) {
    let lock = null;
    if (sheetName === 'number_sequences') {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);
    }

    try {
      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < 2) {
        throw new Error('Cannot update: Sheet ' + sheetName + ' is empty.');
      }

      const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = data[0];
      const idKey = sheetName === 'number_sequences' ? 'sequenceKey' : 'id';
      const idColIdx = headers.indexOf(idKey);

      if (idColIdx === -1) {
        throw new Error('Primary key "' + idKey + '" not found in sheet ' + sheetName);
      }

      let targetRowIdx = -1;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][idColIdx]) === String(id)) {
          targetRowIdx = r;
          break;
        }
      }

      if (targetRowIdx === -1) {
        throw new Error('Record not found with ID "' + id + '" in sheet ' + sheetName);
      }

      const currentRow = data[targetRowIdx];
      const updatedObj = {};

      for (let c = 0; c < headers.length; c++) {
        updatedObj[headers[c]] = currentRow[c];
      }

      // Apply patch
      for (const key in patch) {
        if (headers.includes(key)) {
          updatedObj[key] = patch[key];
        }
      }

      if (headers.includes('updatedAt')) {
        updatedObj.updatedAt = new Date().toISOString();
      }
      if (updatedBy && headers.includes('updatedBy')) {
        updatedObj.updatedBy = updatedBy;
      }

      const updatedRowValues = headers.map((header) => {
        return updatedObj[header] !== undefined ? updatedObj[header] : '';
      });

      // Batch write the updated row
      sheet.getRange(targetRowIdx + 1, 1, 1, updatedRowValues.length).setValues([updatedRowValues]);

      return updatedObj;
    } finally {
      if (lock) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Soft deletes a record by setting deletedAt timestamp.
   */
  softDeleteRow(sheetName, id, deletedBy) {
    const patch = { deletedAt: new Date().toISOString() };
    return this.updateRow(sheetName, id, patch, deletedBy);
  },
};
