/**
 * Billing helper functions & calculation utilities
 */

export interface BillLineItem {
  id?: string;
  description: string;
  amount: number;
  enquiryId?: string;
}

/**
 * Calculates total bill amount from line items
 */
export function calculateBillTotal(items: BillLineItem[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Checks if a set of pending enquiries share the same company and client
 */
export function validateEnquirySelectionCompatibility(enquiries: Array<{ companyId: string; clientId: string }>): {
  compatible: boolean;
  companyId?: string;
  clientId?: string;
  message?: string;
} {
  if (!enquiries || enquiries.length === 0) {
    return { compatible: true };
  }

  const firstCompany = enquiries[0].companyId;
  const firstClient = enquiries[0].clientId;

  for (let i = 1; i < enquiries.length; i++) {
    if (enquiries[i].companyId !== firstCompany || enquiries[i].clientId !== firstClient) {
      return {
        compatible: false,
        message: 'All selected enquiries in a bill must belong to the SAME Company and Client.'
      };
    }
  }

  return {
    compatible: true,
    companyId: firstCompany,
    clientId: firstClient
  };
}

/**
 * Formats bill number display (defaults to 'DRAFT' if unassigned)
 */
export function formatBillNumber(billNumber?: string, status?: string): string {
  if (status === 'DRAFT' || !billNumber) {
    return 'DRAFT';
  }
  return billNumber;
}
