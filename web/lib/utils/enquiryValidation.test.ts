import { describe, it, expect } from 'vitest';
import {
  isValidContainerNumber,
  normalizeContainerNumber,
  enquiryFormSchema,
} from './enquiryValidation';

describe('enquiryValidation (D12 & rules)', () => {
  it('normalizes container numbers correctly', () => {
    expect(normalizeContainerNumber('mscu-1234567')).toBe('MSCU1234567');
    expect(normalizeContainerNumber('  MSCU 1234567 ')).toBe('MSCU1234567');
    expect(normalizeContainerNumber('')).toBe('');
  });

  it('validates ISO 6346 container numbers', () => {
    expect(isValidContainerNumber('MSCU1234567')).toBe(true);
    expect(isValidContainerNumber('tghu9876543')).toBe(true);
    expect(isValidContainerNumber('MSCU123456')).toBe(false); // only 6 digits
    expect(isValidContainerNumber('MSC1234567')).toBe(false); // only 3 letters
    expect(isValidContainerNumber('1234MSCU567')).toBe(false);
  });

  it('validates a valid enquiry form payload', () => {
    const valid = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      vehicleNumber: 'TN04AB1234',
      driverPhone: '9876543210',
      containerNumber: 'MSCU1234567',
      freightAmount: 25000,
      dieselAmount: 8000,
      advanceAmount: 4000,
      extraAdvance: 500,
      haltingDays: 1,
      haltingAmount: 1500,
      bonus: 300,
    };

    const parsed = enquiryFormSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects negative money values', () => {
    const invalid = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Export',
      freightAmount: -500,
    };

    const parsed = enquiryFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('negative');
    }
  });

  it('validates expanded loading types (Empty, Offload, Flattrack)', () => {
    ['Empty', 'Offload', 'Flattrack'].forEach((type) => {
      const res = enquiryFormSchema.safeParse({
        companyId: 'CMP-001',
        clientId: 'CLI-001',
        loadingType: type,
        noOfContainers: 2,
        bookingNumber: 'BK-10029',
        weight: '18000 KG',
        containerFrom: 'ZIRCON CFS',
        containerTo: 'GODREJ AMBATTUR',
        containers: [
          { containerNumber: 'MSCU1234567', vehicleNumber: 'TN04AB1234' },
          { containerNumber: 'GESU7654321', vehicleNumber: 'TN20BZ4732' },
        ],
      });
      expect(res.success).toBe(true);
    });
  });

  it('rejects invalid vehicle and driver formats', () => {
    const invalidVehicle = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      vehicleNumber: 'INVALID_VEHICLE',
    };
    expect(enquiryFormSchema.safeParse(invalidVehicle).success).toBe(false);

    const invalidDriver = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      driverPhone: '12345', // not 10 digits
    };
    expect(enquiryFormSchema.safeParse(invalidDriver).success).toBe(false);
  });

  it('validates invoiceNumber and truck counts correctly', () => {
    const currentYear = new Date().getFullYear();
    const validData = {
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      containerSize: '20 FT',
      noOfContainers: 3,
      truckCount20: 3,
      truckCount40: 0,
      invoiceNumber: `INV-${currentYear}-001`,
      invoiceDate: '27-09-2026',
    };

    const res = enquiryFormSchema.safeParse(validData);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.truckCount20).toBe(3);
      expect(res.data.truckCount40).toBe(0);
      expect(res.data.invoiceNumber).toBe(`INV-${currentYear}-001`);
    }
  });
});
