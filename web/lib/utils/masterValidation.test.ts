import { describe, it, expect } from 'vitest';
import {
  cleanVehicleNumber,
  isValidVehicleNumber,
  cleanDriverPhone,
  isValidDriverPhone,
} from './masterValidation';

describe('Master Data Validation Helpers (D12)', () => {
  describe('Vehicle Number Validation', () => {
    it('cleans and converts lowercase vehicle numbers to uppercase', () => {
      expect(cleanVehicleNumber('tn 04 ab 1234')).toBe('TN04AB1234');
      expect(cleanVehicleNumber('ka-01-cd-5678')).toBe('KA01CD5678');
      expect(cleanVehicleNumber('dl1a9999')).toBe('DL1A9999');
    });

    it('validates standard Indian vehicle number formats', () => {
      expect(isValidVehicleNumber('TN04AB1234')).toBe(true);
      expect(isValidVehicleNumber('tn04ab1234')).toBe(true);
      expect(isValidVehicleNumber('KA01A1234')).toBe(true);
      expect(isValidVehicleNumber('DL011234')).toBe(true);
      expect(isValidVehicleNumber('MH12DE4567')).toBe(true);
    });

    it('rejects invalid vehicle numbers', () => {
      expect(isValidVehicleNumber('INVALID')).toBe(false);
      expect(isValidVehicleNumber('1234')).toBe(false);
      expect(isValidVehicleNumber('TN04AB')).toBe(false);
      expect(isValidVehicleNumber('ABCDEFGHIJ')).toBe(false);
    });
  });

  describe('Driver Mobile Validation', () => {
    it('cleans driver phone numbers by stripping whitespace and dashes', () => {
      expect(cleanDriverPhone('98400 12345')).toBe('9840012345');
      expect(cleanDriverPhone('+91-98400-12345')).toBe('+919840012345');
    });

    it('validates 10-digit Indian mobile numbers starting with 6-9', () => {
      expect(isValidDriverPhone('9840012345')).toBe(true);
      expect(isValidDriverPhone('8765432109')).toBe(true);
      expect(isValidDriverPhone('7012345678')).toBe(true);
      expect(isValidDriverPhone('6987654321')).toBe(true);
    });

    it('rejects numbers that do not have 10 digits or start with invalid digits', () => {
      expect(isValidDriverPhone('12345')).toBe(false); // too short
      expect(isValidDriverPhone('98400123456')).toBe(false); // too long (11 digits)
      expect(isValidDriverPhone('5840012345')).toBe(false); // starts with 5
      expect(isValidDriverPhone('0984001234')).toBe(false); // starts with 0
      expect(isValidDriverPhone('abcdefghij')).toBe(false); // non-numeric
    });
  });
});
