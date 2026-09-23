import { describe, it, expect } from 'vitest';
import { validatePaymentAmount, calculatePaymentStatus } from './paymentsHelper';

describe('paymentsHelper', () => {
  it('validates payment amount against remaining bill balance', () => {
    // Total bill = 10,000, already paid = 4,000 => remaining = 6,000
    expect(validatePaymentAmount(5000, 4000, 10000).valid).toBe(true);
    expect(validatePaymentAmount(6000, 4000, 10000).valid).toBe(true);
    expect(validatePaymentAmount(7000, 4000, 10000).valid).toBe(false);
    expect(validatePaymentAmount(0, 0, 10000).valid).toBe(false);
  });

  it('calculates payment status correctly', () => {
    expect(calculatePaymentStatus(0, 10000)).toBe('UNPAID');
    expect(calculatePaymentStatus(5000, 10000)).toBe('PARTIAL');
    expect(calculatePaymentStatus(10000, 10000)).toBe('PAID');
  });
});
