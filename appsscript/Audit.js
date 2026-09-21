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
 * @param {string} [userId] - User ID performing the action (optional in single-user)
 */
function writeAuditLog(entity, entityId, action, oldValue, newValue, userId) {
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
      userId: String(userId || 'SINGLE_OPERATOR'),
    });
  } catch (err) {
    Logger.log('Warning: writeAuditLog failed: ' + err.message);
  }
}
