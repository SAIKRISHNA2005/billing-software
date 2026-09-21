import { describe, it, expect } from 'vitest';
import { formatCurrencyINR, formatDate, formatDateTime, getFinancialYear } from './format';

describe('formatCurrencyINR', () => {
  it('formats whole numbers correctly with Indian grouping', () => {
    // Note: Intl formatting may use standard non-breaking space or rupee symbol
    const result = formatCurrencyINR(185000);
    expect(result).toMatch(/₹\s?1,85,000\.00/);
  });

  it('formats numbers with decimal points correctly', () => {
    const result = formatCurrencyINR(25000.5);
    expect(result).toMatch(/₹\s?25,000\.50/);
  });

  it('handles zero and nullish inputs gracefully', () => {
    expect(formatCurrencyINR(0)).toMatch(/₹\s?0\.00/);
    expect(formatCurrencyINR(null)).toBe('₹0.00');
    expect(formatCurrencyINR(undefined)).toBe('₹0.00');
  });

  it('formats large numbers into lakhs and crores properly', () => {
    const result = formatCurrencyINR(10000000); // 1 crore
    expect(result).toMatch(/₹\s?1,00,00,000\.00/);
  });
});

describe('formatDate', () => {
  it('formats ISO dates to DD-MM-YYYY', () => {
    expect(formatDate('2026-09-21T12:00:00.000Z')).toBe('21-09-2026');
  });

  it('returns hyphen for null or invalid dates', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('invalid-date')).toBe('-');
  });
});

describe('formatDateTime', () => {
  it('formats ISO dates to DD-MM-YYYY hh:mm A in Asia/Kolkata', () => {
    // 2026-09-21T06:30:00.000Z is 12:00 PM in IST (UTC+5:30)
    expect(formatDateTime('2026-09-21T06:30:00.000Z')).toBe('21-09-2026 12:00 PM');
  });

  it('returns hyphen for empty or invalid dates', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
    expect(formatDateTime('invalid-date')).toBe('-');
  });
});

describe('getFinancialYear', () => {
  it('boundary: 31-December 23:59:59 IST is previous FY', () => {
    // UTC 18:29:59 on 31 Dec 2025 = 23:59:59 IST
    expect(getFinancialYear('2025-12-31T18:29:59.000Z')).toBe('2025-26');
  });

  it('boundary: 01-January 00:00:00 IST starts new FY', () => {
    // UTC 18:30:00 on 31 Dec 2025 = 00:00:00 IST on 01 Jan 2026
    expect(getFinancialYear('2025-12-31T18:30:00.000Z')).toBe('2026-27');
  });

  it('handles leap year: 29-Feb-2024 correctly', () => {
    expect(getFinancialYear('2024-02-29T12:00:00.000Z')).toBe('2024-25');
  });

  it('handles mid-year date: 15-Aug-2026', () => {
    expect(getFinancialYear('2026-08-15T00:00:00.000Z')).toBe('2026-27');
  });

  it('handles year-end date: 31-Dec-2026', () => {
    expect(getFinancialYear('2026-12-31T18:29:59.000Z')).toBe('2026-27');
  });
});
