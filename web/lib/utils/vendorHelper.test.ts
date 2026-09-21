import { describe, it, expect } from 'vitest';
import {
  computeVendorPayable,
  computePending,
  checkOverpayment,
  calculateVendorTotals,
} from './vendorHelper';

describe('Vendor Financial Logic & Helpers', () => {
  it('correctly computes vendor payable from advance, extraAdvance, diesel, halting, bonus', () => {
    const input = {
      advance: 15000,
      extraAdvance: 5000,
      diesel: 25000,
      halting: 2000,
      bonus: 1000,
    };
    const total = computeVendorPayable(input);
    expect(total).toBe(48000);
  });

  it('handles null and undefined values safely in computeVendorPayable', () => {
    const total = computeVendorPayable({
      advance: 10000,
      extraAdvance: null,
      diesel: undefined,
      halting: 1500,
    });
    expect(total).toBe(11500);
  });

  it('correctly computes pending balance', () => {
    const totalPayable = 48000;
    const paid = 30000;
    const pending = computePending(totalPayable, paid);
    expect(pending).toBe(18000);
  });

  it('validates Phase 10 Check Before Commit: Vendor SPT trips ₹1,45,000 and payments ₹1,20,000 shows Pending ₹25,000', () => {
    const totalPayable = 145000;
    const paid = 120000;
    const pending = computePending(totalPayable, paid);
    expect(pending).toBe(25000);
  });

  it('detects overpayment and returns excess amount and warning', () => {
    const check = checkOverpayment(30000, 25000);
    expect(check.isOverpayment).toBe(true);
    expect(check.excess).toBe(5000);
    expect(check.message).toContain('exceeds pending balance');
  });

  it('does not flag overpayment when amount is equal to or less than pending', () => {
    const exact = checkOverpayment(25000, 25000);
    expect(exact.isOverpayment).toBe(false);
    expect(exact.excess).toBe(0);

    const less = checkOverpayment(20000, 25000);
    expect(less.isOverpayment).toBe(false);
    expect(less.excess).toBe(0);
  });

  it('aggregates trips correctly with calculateVendorTotals', () => {
    const trips = [
      { totalPayable: 50000, paid: 40000, pending: 10000 },
      { totalPayable: 95000, paid: 80000, pending: 15000 },
    ];
    const totals = calculateVendorTotals(trips);
    expect(totals.totalPayable).toBe(145000);
    expect(totals.paid).toBe(120000);
    expect(totals.pending).toBe(25000);
  });
});
