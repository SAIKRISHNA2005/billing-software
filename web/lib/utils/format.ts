import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata';

/**
 * Formats a numeric value into Indian Rupee currency format (e.g. ₹1,85,000.00)
 */
export function formatCurrencyINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }

  // Format using Indian Numbering system with 2 decimal places
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return formatted;
}

/**
 * Formats a date string, Date object, or timestamp to DD-MM-YYYY in Asia/Kolkata
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return '-';
  const parsed = dayjs(date).tz(TIMEZONE);
  if (!parsed.isValid()) return '-';
  return parsed.format('DD-MM-YYYY');
}

/**
 * Formats a date string, Date object, or timestamp to DD-MM-YYYY hh:mm A in Asia/Kolkata
 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return '-';
  const parsed = dayjs(date).tz(TIMEZONE);
  if (!parsed.isValid()) return '-';
  return parsed.format('DD-MM-YYYY hh:mm A');
}

/**
 * Calculates Financial Year string (e.g. "2026-27") for a given date in Asia/Kolkata.
 * Cycle: January 1 to December 31.
 * Format: "YYYY-YY" (e.g., 2026 is "2026-27").
 */
export function getFinancialYear(dateInput?: string | number | Date | dayjs.Dayjs | null): string {
  const d = dateInput ? dayjs(dateInput).tz(TIMEZONE) : dayjs().tz(TIMEZONE);
  if (!d.isValid()) {
    throw new Error('Invalid date provided to getFinancialYear');
  }

  const year = d.year();
  const nextYearShort = String(year + 1).slice(-2);

  return `${year}-${nextYearShort}`;
}

