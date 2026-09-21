import { describe, it, expect } from 'vitest';
import { calculateBillTotal, validateEnquirySelectionCompatibility, formatBillNumber } from './billingHelper';

describe('billingHelper utilities', () => {
  it('should calculate bill total correctly', () => {
    const items = [
      { description: 'Transport', amount: 15000 },
      { description: 'Halting', amount: 2500 },
      { description: 'Discount', amount: -500 }
    ];
    expect(calculateBillTotal(items)).toBe(17000);
  });

  it('should return 0 for empty line items', () => {
    expect(calculateBillTotal([])).toBe(0);
  });

  it('should validate selection compatibility for matching company and client', () => {
    const enquiries = [
      { companyId: 'CMP-1', clientId: 'CLT-A' },
      { companyId: 'CMP-1', clientId: 'CLT-A' }
    ];
    const result = validateEnquirySelectionCompatibility(enquiries);
    expect(result.compatible).toBe(true);
    expect(result.companyId).toBe('CMP-1');
    expect(result.clientId).toBe('CLT-A');
  });

  it('should reject incompatible enquiries with different company or client', () => {
    const enquiries = [
      { companyId: 'CMP-1', clientId: 'CLT-A' },
      { companyId: 'CMP-2', clientId: 'CLT-A' }
    ];
    const result = validateEnquirySelectionCompatibility(enquiries);
    expect(result.compatible).toBe(false);
    expect(result.message).toContain('SAME Company and Client');
  });

  it('should format bill number correctly', () => {
    expect(formatBillNumber('203/2026-27', 'PROCESSED')).toBe('203/2026-27');
    expect(formatBillNumber('', 'DRAFT')).toBe('DRAFT');
  });
});
