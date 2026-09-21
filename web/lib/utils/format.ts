import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Kolkata';

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
