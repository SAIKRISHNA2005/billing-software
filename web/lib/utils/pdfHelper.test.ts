import { describe, it, expect } from 'vitest';
import { numberToWordsINR } from './pdfHelper';

describe('pdfHelper', () => {
  it('converts amounts to Indian rupee words correctly', () => {
    expect(numberToWordsINR(185000)).toBe('Rupees One Lakh Eighty Five Thousand Only');
    expect(numberToWordsINR(500)).toBe('Rupees Five Hundred Only');
    expect(numberToWordsINR(0)).toBe('Zero Rupees Only');
    expect(numberToWordsINR(12500000)).toBe('Rupees One Crore Twenty Five Lakh Only');
  });
});
