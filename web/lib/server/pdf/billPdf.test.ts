import { describe, it, expect, vi } from 'vitest';
import { generateBillHtml } from './billTemplate';
import { mapBillData } from './billDataMapper';
import { generateBillPdfBuffer } from './billPdfGenerator';
import * as appsScriptClient from '@/lib/server/appsScriptClient';
import { BillData } from './types';

const TEST_BILL_FIXTURE: BillData = {
  id: 'BIL-409380',
  billNumber: '231/2026-27',
  billDate: '14-08-2026',
  financialYear: '2026-27',
  status: 'PROCESSED',
  client: {
    name: 'SIJA LOGISTICS PVT. LTD.',
    address: '#37/24 | Narayana Sarang Garden Street,\nParrys, Chennai - 600 001.',
  },
  company: {
    id: 'CMP-001',
    name: 'SRI PONNIAMMAN TRANS',
    address: 'No. 12/1, Coral Merchant Street, Chennai - 600 001.',
    gstin: '33ASLPD2964M1ZH',
    pan: 'ASLPD2964M',
    phone: 'Tel: 42061100, Cell : 99417 80675',
    email: 'dharmasriponniammantrans@gmail.com',
  },
  loadType: 'Export',
  containerFrom: 'ZIRCON',
  containerTo: 'GODREJ AMBATTUR',
  routeText: 'ZIRCON TO GODREJ AMBATTUR',
  truckCount20: 3,
  truckCount40: 6,
  truckNumbers: ['TN20BZ4732', 'TN04Q7661'],
  containerNumbers: ['TEMU6210099', 'MSKU1673779'],
  charges: [
    {
      sNo: 1,
      description: 'Freight Charges',
      freightCharges: 12000,
      otherCharges: null,
      haltingCharges: null,
      advance: 12000,
      rate: null,
      amount: 36000,
    },
    {
      sNo: 2,
      description: 'Other Charges',
      freightCharges: null,
      otherCharges: 22000,
      haltingCharges: null,
      advance: null,
      rate: null,
      amount: 22000,
    },
  ],
  totals: {
    freightTotal: 36000,
    otherChargesTotal: 22000,
    haltingTotal: 0,
    advanceTotal: 12000,
    grandTotal: 58000,
  },
  totalInWords: 'Fifty Eight Thousand Only',
};

describe('Bill PDF System Tests', () => {
  it('renders bill HTML conforming to Sri Ponniamman Trans reference layout', () => {
    const html = generateBillHtml(TEST_BILL_FIXTURE);

    // 1. Header elements
    expect(html).toContain('SRI PONNIAMMAN TRANS');
    expect(html).toContain('Fleet Owners & Transport Contractors');
    expect(html).toContain('No. 12/1, Coral Merchant Street, Chennai - 600 001.');
    expect(html).toContain('dharmasriponniammantrans@gmail.com');

    // 2. Client TO section (Must NOT contain GST/PAN)
    expect(html).toContain('SIJA LOGISTICS PVT. LTD.');
    expect(html).toContain('#37/24 | Narayana Sarang Garden Street');
    // Ensure TO section does not put GST in the TO box
    const toBoxContent = html.substring(html.indexOf('info-left-to'), html.indexOf('info-right-details'));
    expect(toBoxContent).not.toContain('33ASLPD2964M1ZH');
    expect(toBoxContent).not.toContain('GST No');

    // 3. Bill details section
    expect(html).toContain('231/2026-27');
    expect(html).toContain('14-08-2026');
    expect(html).toContain('ZIRCON TO GODREJ AMBATTUR');
    expect(html).toContain('3</span>');
    expect(html).toContain('X 20 FEET');
    expect(html).toContain('6</span>');
    expect(html).toContain('X 40 FEET');

    // 4. Charges table
    expect(html).toContain('Freight Charges');
    expect(html).toContain('Other Charges');
    expect(html).toContain('Halting Charges');
    expect(html).toContain('Advance');

    // 5. Total in words
    expect(html).toContain('Fifty Eight Thousand Only');

    // 6. Bottom GST/PAN section
    expect(html).toContain('33ASLPD2964M1ZH');
    expect(html).toContain('ASLPD2964M');

    // 7. Seal & Signatory
    expect(html).toContain('Seal & Signature');
  });

  it('maps existing bill BILL-0005 into clean BillData', async () => {
    vi.spyOn(appsScriptClient, 'callAppsScript').mockImplementation(async (action: string, payload: any) => {
      if (action === 'bill.get' && payload?.id === 'BILL-0005') {
        return {
          success: true,
          data: {
            id: 'BILL-0005',
            billNumber: '231/2026-27',
            clientName: 'SIJA LOGISTICS PVT. LTD.',
            clientAddress: '#37/24 | Narayana Sarang Garden Street\nSowcarpet, Chennai - 600 079.',
            billingDate: '2026-08-14',
            totalAmount: 58000,
            status: 'PROCESSED',
            truckCount20: 3,
            truckCount40: 6,
            charges: [
              { description: 'Transport charges', amount: 58000 }
            ],
            enquiries: [
              {
                id: 'ENQ-001',
                containerFrom: 'ZIRCON',
                containerTo: 'GODREJ AMBATTUR',
                truckCount20: 3,
                truckCount40: 6,
                rate: 58000,
                amount: 58000
              }
            ]
          },
          message: 'Operation completed successfully'
        } as any;
      }
      return { success: false, data: null, message: 'Not found' };
    });

    const billData = await mapBillData('BILL-0005', null);

    expect(billData.id).toBe('BILL-0005');
    expect(billData.billNumber).toBe('231/2026-27');
    expect(billData.client.name).toBe('SIJA LOGISTICS PVT. LTD.');
    expect(billData.truckCount20).toBe(3);
    expect(billData.truckCount40).toBe(6);
    expect(billData.totals.grandTotal).toBe(58000);
    expect(billData.totalInWords).toContain('Fifty Eight Thousand Only');
    expect(billData.charges.length).toBeGreaterThan(0);
  });

  it('handles edge case: throws controlled error for missing or non-existent bill', async () => {
    await expect(mapBillData('NON-EXISTENT-XYZ-999', null)).rejects.toThrow(
      'could not be found'
    );
    await expect(mapBillData('', null)).rejects.toThrow(
      'A valid bill identifier'
    );
  });

  it('generates an in-memory PDF buffer with valid %PDF- header', async () => {
    const html = generateBillHtml(TEST_BILL_FIXTURE);
    const buffer = await generateBillPdfBuffer(html);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const magicHeader = buffer.slice(0, 5).toString();
    expect(magicHeader).toBe('%PDF-');
  }, 30000);
});
