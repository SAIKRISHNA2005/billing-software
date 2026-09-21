/**
 * Transport & Logistics Management System (TMS)
 * Financial Year Calculation Helper
 *
 * Business Rule: Financial Year runs from January 1st to December 31st (Calendar Year).
 * Format: Two-year span format "YYYY-YY" (e.g., 2026 is "2026-27").
 * Boundary: Resets every January 1st at 00:00:00 Asia/Kolkata.
 */

/**
 * Calculates Financial Year string (e.g. "2026-27") for a given date in Asia/Kolkata timezone.
 * Cycle: January 1 to December 31.
 *
 * @param {Date|string|number} inputDate - Date object, ISO string, or timestamp
 * @returns {string} Financial year label in YYYY-YY format (e.g. "2026-27")
 */
function getFinancialYear(inputDate) {
  let date;
  if (!inputDate) {
    date = new Date();
  } else if (inputDate instanceof Date) {
    date = inputDate;
  } else {
    date = new Date(inputDate);
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided to getFinancialYear: ' + inputDate);
  }

  // Format date parts explicitly in Asia/Kolkata timezone
  const istYearString = Utilities.formatDate(date, 'Asia/Kolkata', 'yyyy');
  const year = parseInt(istYearString, 10);
  const nextYearShort = String(year + 1).slice(-2);

  return year + '-' + nextYearShort;
}
