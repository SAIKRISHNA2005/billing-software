export interface BillPaymentItem {
  id: string;
  billId: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
}

export function validatePaymentAmount(newAmount: number, currentPaid: number, billTotal: number): { valid: boolean; error?: string } {
  if (isNaN(newAmount) || newAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than zero' };
  }

  const remaining = billTotal - currentPaid;
  if (newAmount > remaining + 0.01) {
    return {
      valid: false,
      error: `Payment amount (₹${newAmount.toFixed(2)}) exceeds remaining balance (₹${remaining.toFixed(2)})`,
    };
  }

  return { valid: true };
}

export function calculatePaymentStatus(totalPaid: number, billTotal: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (totalPaid >= billTotal && billTotal > 0) return 'PAID';
  if (totalPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}
