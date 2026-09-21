/**
 * Transport & Logistics Management System (TMS)
 * Phase 7 - Vendor Finance Calculation Utility
 * STRICT RULES: D7 (Single unified formula for Vendor Total Payable & Vendor Pending).
 * Mirror of appsscript/VendorFinance.js - must stay 100% mathematically identical!
 */

export interface EnquiryMoneyInput {
  advanceAmount?: number | string | null;
  extraAdvance?: number | string | null;
  dieselAmount?: number | string | null;
  haltingAmount?: number | string | null;
  bonus?: number | string | null;
}

export interface VendorPaymentItem {
  amount?: number | string | null;
  deletedAt?: string | null;
}

export interface VendorFinanceBreakdown {
  advance: number;
  extraAdvance: number;
  diesel: number;
  halting: number;
  bonus: number;
  totalPayable: number;
  totalPaid: number;
  balance: number;
}

/**
 * Computes Vendor Total Payable and balance for an enquiry.
 * Formula (D7):
 * Total Payable = Advance + Extra Advance + Diesel + Halting + Bonus
 *
 * @param enquiry The enquiry object or form values containing money fields
 * @param vendorPayments Optional array of recorded vendor payments
 * @returns Breakdown with rounded numbers
 */
export function computeVendorPayable(
  enquiry?: EnquiryMoneyInput | null,
  vendorPayments?: VendorPaymentItem[] | null
): VendorFinanceBreakdown {
  const advance = parseFloat(String(enquiry?.advanceAmount ?? '0')) || 0;
  const extraAdvance = parseFloat(String(enquiry?.extraAdvance ?? '0')) || 0;
  const diesel = parseFloat(String(enquiry?.dieselAmount ?? '0')) || 0;
  const halting = parseFloat(String(enquiry?.haltingAmount ?? '0')) || 0;
  const bonus = parseFloat(String(enquiry?.bonus ?? '0')) || 0;

  const totalPayable = advance + extraAdvance + diesel + halting + bonus;

  let totalPaid = 0;
  if (Array.isArray(vendorPayments)) {
    for (let i = 0; i < vendorPayments.length; i++) {
      const p = vendorPayments[i];
      if (!p?.deletedAt) {
        totalPaid += parseFloat(String(p?.amount ?? '0')) || 0;
      }
    }
  }

  const balance = totalPayable - totalPaid;

  return {
    advance,
    extraAdvance,
    diesel,
    halting,
    bonus,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance: Math.round(balance * 100) / 100,
  };
}
