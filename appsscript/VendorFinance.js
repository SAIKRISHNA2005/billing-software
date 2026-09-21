/**
 * Transport & Logistics Management System (TMS)
 * Phase 6 - Vendor Finance Calculation Module
 * STRICT RULES: D7 (Single unified formula for Vendor Total Payable & Vendor Pending).
 */

/**
 * Computes Vendor Total Payable and balance for an enquiry.
 * Formula (D7):
 * Total Payable = Advance + Extra Advance + Diesel + Halting + Bonus
 *
 * @param {object} enquiry - The enquiry object with money fields
 * @param {Array<object>} [vendorPayments] - Optional list of vendor payments recorded for this enquiry
 * @returns {object} Breakdown of vendor payable values
 */
function computeVendorPayable(enquiry, vendorPayments) {
  const advance = parseFloat(enquiry?.advanceAmount) || 0;
  const extraAdvance = parseFloat(enquiry?.extraAdvance) || 0;
  const diesel = parseFloat(enquiry?.dieselAmount) || 0;
  const halting = parseFloat(enquiry?.haltingAmount) || 0;
  const bonus = parseFloat(enquiry?.bonus) || 0;

  const totalPayable = advance + extraAdvance + diesel + halting + bonus;

  let totalPaid = 0;
  if (Array.isArray(vendorPayments)) {
    for (let i = 0; i < vendorPayments.length; i++) {
      const p = vendorPayments[i];
      if (!p.deletedAt) {
        totalPaid += parseFloat(p.amount) || 0;
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

const VendorFinance = {
  computeVendorPayable: computeVendorPayable,
};
