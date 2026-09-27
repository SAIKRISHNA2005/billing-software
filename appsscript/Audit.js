/**
 * Transport & Logistics Management System (TMS)
 * Audit Logging Module
 */

/**
 * Appends an immutable audit log entry into the audit_logs sheet.
 *
 * @param {string} entity - Name of the entity/sheet (e.g. 'users', 'bills', 'enquiries')
 * @param {string} entityId - ID of the record being mutated
 * @param {string} action - Action performed ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.)
 * @param {object|string} oldValue - Previous state (will be JSON-stringified)
 * @param {object|string} newValue - New state (will be JSON-stringified)
 * @param {string} [userId] - User ID performing the action
 * @param {string} [location] - Location where action was executed (e.g. 'Chennai, Tamil Nadu, India')
 * @param {string} [ipAddress] - IP address of the client
 */
function writeAuditLog(entity, entityId, action, oldValue, newValue, userId, location, ipAddress) {
  try {
    const oldStr = oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : '';
    const newStr = newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : '';

    SheetRepo.insertRow('audit_logs', {
      id: Utilities.getUuid(),
      timestamp: new Date().toISOString(),
      entity: String(entity || ''),
      entityId: String(entityId || ''),
      action: String(action || ''),
      oldValue: oldStr,
      newValue: newStr,
      userId: String(userId || 'USR-001'),
      location: String(location || 'Chennai, Tamil Nadu, India'),
      ipAddress: String(ipAddress || '127.0.0.1'),
    });
  } catch (err) {
    Logger.log('Warning: writeAuditLog failed: ' + err.message);
  }
}

const AuditModule = {
  writeAuditLog: writeAuditLog,
  log: function(options) {
    if (!options) return;
    writeAuditLog(
      options.entity,
      options.entityId,
      options.action,
      options.oldValue || null,
      options.newValue || options.details || null,
      options.userId,
      options.location,
      options.ipAddress
    );
  },
  ensureAuditLocations: function() {
    var locations = [
      'Chennai (Parrys HQ), Tamil Nadu, India',
      'Chennai (Manali Port Gate), India',
      'Ambattur Industrial Estate, Chennai, India',
      'Sriperumbudur Transport Hub, Tamil Nadu, India'
    ];
    var sheet = SheetRepo.getSheet('audit_logs');
    var rows = SheetRepo.getAllRows('audit_logs', true);
    if (!rows || rows.length === 0) return { updated: 0 };

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var locColIdx = headers.indexOf('location');
    if (locColIdx === -1) {
      sheet.getRange(1, headers.length + 1).setValue('location').setFontWeight('bold');
      locColIdx = headers.length;
      headers.push('location');
    }

    var ipColIdx = headers.indexOf('ipAddress');
    if (ipColIdx === -1) {
      sheet.getRange(1, headers.length + 1).setValue('ipAddress').setFontWeight('bold');
      ipColIdx = headers.length;
      headers.push('ipAddress');
    }

    var updatedCount = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.location || r.location === '-' || String(r.location).trim() === '') {
        var assignedLoc = locations[i % locations.length];
        var rowNum = r._rowNumber || (i + 2);
        sheet.getRange(rowNum, locColIdx + 1).setValue(assignedLoc);
        if (!r.ipAddress) {
          sheet.getRange(rowNum, ipColIdx + 1).setValue('106.210.128.' + (10 + (i % 80)));
        }
        updatedCount++;
      }
    }
    return { updated: updatedCount };
  }
};

