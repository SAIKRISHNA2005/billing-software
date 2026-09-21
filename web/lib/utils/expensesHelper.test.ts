import { describe, it, expect } from 'vitest';
import {
  formatINR,
  calculateExpenseTotals,
  getLoadingCategoryColor,
  getGeneralCategoryColor,
  LOADING_EXPENSE_CATEGORIES,
  GENERAL_EXPENSE_CATEGORIES,
} from './expensesHelper';

describe('expensesHelper', () => {
  it('formats currency correctly in Indian Rupee format', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(3000)).toBe('₹3,000.00');
    expect(formatINR(185000.5)).toBe('₹1,85,000.50');
    expect(formatINR(null)).toBe('₹0.00');
    expect(formatINR(undefined)).toBe('₹0.00');
  });

  it('correctly aggregates totals and category breakdowns', () => {
    const items = [
      { id: '1', amount: 3000, category: 'Diesel' },
      { id: '2', amount: 500, category: 'Parking' },
      { id: '3', amount: 1500, category: 'Diesel' },
    ];

    const result = calculateExpenseTotals(items);
    expect(result.totalAmount).toBe(5000);
    expect(result.count).toBe(3);
    expect(result.categoryBreakdown['Diesel']).toBe(4500);
    expect(result.categoryBreakdown['Parking']).toBe(500);
  });

  it('returns valid color tags for loading categories', () => {
    LOADING_EXPENSE_CATEGORIES.forEach((cat) => {
      const color = getLoadingCategoryColor(cat);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });

  it('returns valid color tags for general categories', () => {
    GENERAL_EXPENSE_CATEGORIES.forEach((cat) => {
      const color = getGeneralCategoryColor(cat);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });
});
