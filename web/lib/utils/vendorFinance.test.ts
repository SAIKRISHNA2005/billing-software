import { describe, it, expect } from 'vitest';
import { computeVendorPayable } from './vendorFinance';

describe('computeVendorPayable (D7 calculation)', () => {
  it('calculates total payable as advance + extraAdvance + diesel + halting + bonus', () => {
    const enquiry = {
      advanceAmount: 5000,
      extraAdvance: 1000,
      dieselAmount: 12000,
      haltingAmount: 2500,
      bonus: 500,
    };

    const result = computeVendorPayable(enquiry);
    // 5000 + 1000 + 12000 + 2500 + 500 = 21000
    expect(result.totalPayable).toBe(21000);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(21000);
  });

  it('handles string numeric inputs gracefully', () => {
    const enquiry = {
      advanceAmount: '3500.50',
      extraAdvance: '500.25',
      dieselAmount: '8000',
      haltingAmount: '1200',
      bonus: '0',
    };

    const result = computeVendorPayable(enquiry);
    // 3500.50 + 500.25 + 8000 + 1200 + 0 = 13200.75
    expect(result.totalPayable).toBe(13200.75);
    expect(result.balance).toBe(13200.75);
  });

  it('handles null, undefined, and empty inputs with 0 defaults', () => {
    const result = computeVendorPayable({});
    expect(result.totalPayable).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(0);

    const resultNull = computeVendorPayable(null);
    expect(resultNull.totalPayable).toBe(0);
  });

  it('correctly deducts valid vendor payments and ignores soft-deleted ones', () => {
    const enquiry = {
      advanceAmount: 10000,
      extraAdvance: 0,
      dieselAmount: 15000,
      haltingAmount: 0,
      bonus: 1000,
    }; // Total Payable = 26000

    const payments = [
      { amount: 10000 },
      { amount: 5000, deletedAt: '2026-09-20T10:00:00Z' }, // deleted, ignore!
      { amount: 6000 },
    ];

    const result = computeVendorPayable(enquiry, payments);
    expect(result.totalPayable).toBe(26000);
    expect(result.totalPaid).toBe(16000); // 10000 + 6000
    expect(result.balance).toBe(10000); // 26000 - 16000
  });

  it('matches exactly the Apps Script test fixture from Tests_Enquiry.js', () => {
    // Exact fixture from Tests_Enquiry.js
    const fixture = {
      advanceAmount: 5000,
      extraAdvance: 1500,
      dieselAmount: 12000,
      haltingAmount: 2000,
      bonus: 500,
    };
    const breakdown = computeVendorPayable(fixture);
    expect(breakdown.totalPayable).toBe(21000);
    expect(breakdown.advance).toBe(5000);
    expect(breakdown.extraAdvance).toBe(1500);
    expect(breakdown.diesel).toBe(12000);
    expect(breakdown.halting).toBe(2000);
    expect(breakdown.bonus).toBe(500);
  });
});
