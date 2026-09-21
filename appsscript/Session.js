/**
 * Transport & Logistics Management System (TMS)
 * Session Validation & Lifecycle Module
 */

/**
 * Validates that an incoming sessionToken exists in the sessions sheet and is unexpired.
 * Throws an Error with code UNAUTHORIZED if invalid.
 * Updates lastActiveAt for active sessions.
 *
 * @param {string} sessionToken - The opaque session token
 * @returns {object} The validated session object
 */
function requireSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim() === '') {
    const err = new Error('Authentication required: No session token provided.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const allSessions = SheetRepo.getAllRows('sessions', true);
  const session = allSessions.find((s) => s.token === sessionToken);

  if (!session) {
    const err = new Error('Session invalid: Session not found.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (isNaN(expiresAt.getTime()) || now > expiresAt) {
    // Delete expired session
    try {
      deleteSessionByToken(sessionToken);
    } catch (e) {
      // Ignore cleanup error
    }
    const err = new Error('Session expired: Please log in again.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  // Update lastActiveAt periodically (e.g. if older than 5 minutes)
  try {
    const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt) : new Date(0);
    if (now.getTime() - lastActive.getTime() > 5 * 60 * 1000) {
      SheetRepo.updateRow('sessions', sessionToken, { lastActiveAt: now.toISOString() });
    }
  } catch (e) {
    // Non-critical, continue
  }

  return session;
}

/**
 * Removes a session row by token.
 */
function deleteSessionByToken(token) {
  const sheet = SheetRepo.getSheet('sessions');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const data = sheet.getRange(1, 1, lastRow, 1).getValues(); // Token is column 1 (A)
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === String(token)) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/**
 * Removes all sessions for a specific userId (e.g. on password change).
 */
function deleteAllSessionsForUser(userId) {
  const sheet = SheetRepo.getSheet('sessions');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = sheet.getRange(1, 1, lastRow, 2).getValues(); // userId is column 2 (B)
  let deletedCount = 0;

  // Loop backwards to preserve row indices during deletion
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][1]) === String(userId)) {
      sheet.deleteRow(r + 1);
      deletedCount++;
    }
  }
  return deletedCount;
}
