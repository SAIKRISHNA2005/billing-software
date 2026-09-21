/**
 * Expense utility functions, types, and category color mappings
 */

export const LOADING_EXPENSE_CATEGORIES = [
  'Diesel',
  'Loading Charges',
  'Unloading Charges',
  'Parking',
  'Halting',
  'Other Trip Expenses',
] as const;

export type LoadingExpenseCategory = (typeof LOADING_EXPENSE_CATEGORIES)[number];

export const GENERAL_EXPENSE_CATEGORIES = [
  'Office Stationery',
  'Internet',
  'Electricity',
  'Tea/Coffee',
  'Maintenance',
  'Salary-Related',
  'Office Repairs',
  'Other',
] as const;

export type GeneralExpenseCategory = (typeof GENERAL_EXPENSE_CATEGORIES)[number];

export interface LoadingExpenseItem {
  id: string;
  expenseDate: string;
  category: LoadingExpenseCategory;
  amount: number;
  description?: string;
  enquiryId?: string;
  vehicleId?: string;
  source: 'ENQUIRY' | 'MANUAL';
  enquiryNumber?: string | null;
  vehicleNumber?: string | null;
  companyName?: string | null;
  clientName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeneralExpenseItem {
  id: string;
  expenseDate: string;
  category: GeneralExpenseCategory;
  amount: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseTotals {
  totalAmount: number;
  count: number;
  categoryBreakdown: Record<string, number>;
}

/**
 * Maps loading expense category to UI badge/tag color
 */
export function getLoadingCategoryColor(category: string): string {
  switch (category) {
    case 'Diesel':
      return 'gold';
    case 'Loading Charges':
      return 'blue';
    case 'Unloading Charges':
      return 'cyan';
    case 'Parking':
      return 'purple';
    case 'Halting':
      return 'orange';
    case 'Other Trip Expenses':
    default:
      return 'default';
  }
}

/**
 * Maps general expense category to UI badge/tag color
 */
export function getGeneralCategoryColor(category: string): string {
  switch (category) {
    case 'Office Stationery':
      return 'blue';
    case 'Internet':
      return 'geekblue';
    case 'Electricity':
      return 'gold';
    case 'Tea/Coffee':
      return 'orange';
    case 'Maintenance':
      return 'magenta';
    case 'Salary-Related':
      return 'green';
    case 'Office Repairs':
      return 'volcano';
    case 'Other':
    default:
      return 'default';
  }
}

/**
 * Formats a numeric value into standard Indian Currency string
 * Example: 3500 => "₹3,500.00"
 */
export function formatINR(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Aggregates total amount and count from an array of expense records
 */
export function calculateExpenseTotals<T extends { amount: number; category?: string }>(
  items: T[]
): ExpenseTotals {
  let totalAmount = 0;
  const categoryBreakdown: Record<string, number> = {};

  (items || []).forEach((item) => {
    const amt = typeof item.amount === 'number' && !isNaN(item.amount) ? item.amount : 0;
    totalAmount += amt;
    const cat = item.category || 'Other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
  });

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    count: items ? items.length : 0,
    categoryBreakdown,
  };
}
