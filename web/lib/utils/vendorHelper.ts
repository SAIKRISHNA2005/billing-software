/**
 * Vendor financial calculations and validations.
 * Adheres strictly to D7 in docs/PROJECT_DETAILS.md:
 * Vendor Total Payable = Advance + Extra Advance + Diesel + Halting + Bonus
 * Pending = Total Payable - Paid
 */

export interface VendorTripPayableInput {
  advance?: number | null;
  extraAdvance?: number | null;
  diesel?: number | null;
  halting?: number | null;
  bonus?: number | null;
}

export function computeVendorPayable(input: VendorTripPayableInput): number {
  const advance = Number(input.advance) || 0;
  const extraAdvance = Number(input.extraAdvance) || 0;
  const diesel = Number(input.diesel) || 0;
  const halting = Number(input.halting) || 0;
  const bonus = Number(input.bonus) || 0;

  return advance + extraAdvance + diesel + halting + bonus;
}

export function computePending(totalPayable: number, paid: number): number {
  return Number((totalPayable - paid).toFixed(2));
}

export function checkOverpayment(amount: number, pending: number): {
  isOverpayment: boolean;
  excess: number;
  message?: string;
} {
  const numAmount = Number(amount) || 0;
  const numPending = Number(pending) || 0;

  if (numAmount > numPending) {
    const excess = Number((numAmount - numPending).toFixed(2));
    return {
      isOverpayment: true,
      excess,
      message: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds pending balance (₹${numPending.toLocaleString('en-IN')}) by ₹${excess.toLocaleString('en-IN')}.`,
    };
  }

  return {
    isOverpayment: false,
    excess: 0,
  };
}

export function calculateVendorTotals(trips: Array<{ totalPayable: number; paid: number; pending: number }>) {
  return trips.reduce(
    (acc, trip) => {
      acc.totalPayable += trip.totalPayable || 0;
      acc.paid += trip.paid || 0;
      acc.pending += trip.pending || 0;
      return acc;
    },
    { totalPayable: 0, paid: 0, pending: 0 }
  );
}
