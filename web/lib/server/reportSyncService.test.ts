import { describe, it, expect } from 'vitest';
import { mapEnquiryToDailyRecord } from './reportSyncService';

describe('ReportSyncService Unit Tests', () => {
  it('correctly maps enquiry to 23 standard Daily Report columns', () => {
    const rawEnquiry = {
      id: 'ENQ-10060',
      createdAt: '2026-09-27T10:30:00.000Z',
      date: '2026-09-27',
      bookingDate: '2026-09-27',
      companyName: 'VALEO',
      clientId: 'CLI-002',
      clientName: 'SIA LOGISTICS',
      billId: 'BILL-0001',
      billingNumber: 'INV/2026-27/00001',
      transactionNumber: 'TXN/2026-27/00060',
      containerSize: '40 FT',
      containerNumber: 'HLBU2126820',
      sealNumber: 'SEAL-9988',
      vehicleNumber: 'TN04AB1234',
      driverInfo: '9876543210',
      dieselAmount: 2500,
      advanceAmount: 5000,
      loadingType: 'Export',
      remarks: 'Fragile automotive parts',
      movement: {
        companyInTime: '08:00 AM',
        companyOutTime: '10:00 AM',
        printInTime: '11:00 AM',
        printOutTime: '11:30 AM',
        portInTime: '01:00 PM',
        portOutTime: '03:00 PM',
        movementStatus: 'MOVED',
        shippingStatus: 'COMPLETED',
      },
    };

    const record = mapEnquiryToDailyRecord(rawEnquiry);

    expect(record.id).toBe('ENQ-10060');
    expect(record.creationDate).toBe('2026-09-27');
    expect(record.bookingDate).toBe('2026-09-27');
    expect(record.companyName).toBe('VALEO');
    expect(record.loadingType).toBe('Export');
    expect(record.clientName).toBe('SIA LOGISTICS');
    expect(record.billingNumber).toBe('INV/2026-27/00001');
    expect(record.bookingNumber).toBe('TXN/2026-27/00060');
    expect(record.feet).toBe('40 FT');
    expect(record.containerNumber).toBe('HLBU2126820');
    expect(record.sealNumber).toBe('SEAL-9988');
    expect(record.vehicleNumber).toBe('TN04AB1234');
    expect(record.driverNumber).toBe('9876543210');
    expect(record.diesel).toBe(2500);
    expect(record.advance).toBe(5000);
    expect(record.companyIn).toBe('08:00 AM');
    expect(record.companyOut).toBe('10:00 AM');
    expect(record.printIn).toBe('11:00 AM');
    expect(record.printOut).toBe('11:30 AM');
    expect(record.portIn).toBe('01:00 PM');
    expect(record.portOut).toBe('03:00 PM');
    expect(record.movementStatus).toBe('MOVED');
    expect(record.shippingStatus).toBe('COMPLETED');
    expect(record.comments).toBe('Fragile automotive parts');
  });

  it('provides safe fallbacks for missing fields', () => {
    const rawEnquiry = {
      id: 'ENQ-10061',
    };

    const record = mapEnquiryToDailyRecord(rawEnquiry);

    expect(record.id).toBe('ENQ-10061');
    expect(record.companyName).toBe('General');
    expect(record.loadingType).toBe('Import');
    expect(record.billingNumber).toBe('-');
    expect(record.sealNumber).toBe('-');
    expect(record.driverNumber).toBe('-');
    expect(record.diesel).toBe(0);
    expect(record.advance).toBe(0);
    expect(record.movementStatus).toBe('NOT_MOVED');
    expect(record.shippingStatus).toBe('PENDING');
  });
});
