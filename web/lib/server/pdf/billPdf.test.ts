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
      haltingCharges: 1000,
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
    haltingTotal: 1000,
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
    expect(html).toContain('Authorised Signatory');
  });

  it('dynamically excludes columns with 0 charges and includes custom charges and advance deduction', () => {
    const fixtureWithOmittedColumns: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Consignment TN20BZ4732 / TEMU6210099',
          freightCharges: 15000,
          otherCharges: null, // empty
          haltingCharges: null, // empty
          advance: 3000, // advance present
          customCharges: [
            { name: 'Toll Charges', amount: 450 },
          ],
          rate: null,
          amount: 12450, // (15000 + 450) - 3000
        },
      ],
      totals: {
        freightTotal: 15000,
        otherChargesTotal: 0,
        haltingTotal: 0,
        advanceTotal: 3000,
        grandTotal: 12450,
      },
      totalInWords: 'Twelve Thousand Four Hundred Fifty Rupees Only',
    };

    const html = generateBillHtml(fixtureWithOmittedColumns);

    // Freight, Toll Charges, Advance, and Amount columns should be present
    expect(html).toContain('Freight Charges');
    expect(html).toContain('Toll Charges');
    expect(html).toContain('Advance Paid');
    expect(html).toContain('12,450.00');

    // Empty charges columns should be completely removed from the table headers
    expect(html).not.toContain('Halting Charges<br>(INR)');
    expect(html).not.toContain('Other Charges<br>(INR)');
  });

  it('correctly maps ENQ-10045 scenario with Freight, Halting, and Advance deduction', () => {
    const enq10045Bill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Transportation Charges - Enquiry #10045',
          freightCharges: 340000,
          haltingCharges: 4000,
          otherCharges: null,
          advance: 15000, // 10000 advance + 5000 extra advance
          customCharges: [],
          rate: null,
          amount: 329000, // 344000 - 15000
        },
      ],
      totals: {
        freightTotal: 340000,
        otherChargesTotal: 0,
        haltingTotal: 4000,
        advanceTotal: 15000,
        grandTotal: 329000,
      },
      totalInWords: 'Three Lakh Twenty Nine Thousand Rupees Only',
    };

    const html = generateBillHtml(enq10045Bill);

    // Verify Freight, Halting, Advance Paid, and Amount headers exist
    expect(html).toContain('Freight Charges');
    expect(html).toContain('Halting Charges');
    expect(html).toContain('Advance Paid<br>(Deduction)');
    expect(html).toContain('Amount<br>(INR)');

    // Verify Other Charges is not in headers
    expect(html).not.toContain('Other Charges<br>(INR)');

    // Verify values in HTML
    expect(html).toContain('3,40,000.00');
    expect(html).toContain('4,000.00');
    expect(html).toContain('- 15,000.00');
    expect(html).toContain('3,29,000.00');
    expect(html).toContain('Three Lakh Twenty Nine Thousand Rupees Only');
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

  it('correctly maps multi-container enquiry with 3 trucks and 3 containers in description table', async () => {
    vi.spyOn(appsScriptClient, 'callAppsScript').mockImplementation(async (action: string, payload: any) => {
      if (action === 'bill.get' && payload?.id === 'BILL-MULTI-3') {
        return {
          success: true,
          data: {
            id: 'BILL-MULTI-3',
            billNumber: '100/2026-27',
            clientName: 'VIJAY LOGISTICS',
            clientAddress: '123 Harbor Road, Chennai',
            billingDate: '2026-10-12',
            totalAmount: 180000,
            status: 'PROCESSED',
            enquiryIds: ['ENQ-10045'],
            enquiries: [
              {
                id: 'ENQ-10045',
                freightAmount: 180000,
                containers: [
                  { containerNumber: 'MSCU1111111', vehicleNumber: 'TN04AB1111' },
                  { containerNumber: 'HLBU2222222', vehicleNumber: 'TN04CD2222' },
                  { containerNumber: 'MEDU3333333', vehicleNumber: 'TN04EF3333' },
                ],
              },
            ],
          },
          message: 'Operation completed successfully',
        } as any;
      }
      return { success: false, data: null, message: 'Not found' } as any;
    });

    const billData = await mapBillData('BILL-MULTI-3', null);
    expect(billData.charges.length).toBe(1);
    const descHtml = billData.charges[0].descriptionHtml;
    expect(descHtml).toContain('MSCU1111111');
    expect(descHtml).toContain('TN04AB1111');
    expect(descHtml).toContain('HLBU2222222');
    expect(descHtml).toContain('TN04CD2222');
    expect(descHtml).toContain('MEDU3333333');
    expect(descHtml).toContain('TN04EF3333');

    const html = generateBillHtml(billData);
    expect(html).toContain('MSCU1111111');
    expect(html).toContain('HLBU2222222');
    expect(html).toContain('MEDU3333333');
    expect(html).toContain('TN04AB1111');
    expect(html).toContain('TN04CD2222');
    expect(html).toContain('TN04EF3333');
  });

  it('renders custom charge columns dynamically with exact name and value', () => {
    const fixtureWithCustomCharges: BillData = {
      ...TEST_BILL_FIXTURE,
      assets: {
        signatureImage: 'data:image/png;base64,mockSign',
        sealImage: 'data:image/png;base64,mockSeal',
      },
      charges: [
        {
          sNo: 1,
          description: 'Transportation Charges - Enquiry #10045',
          freightCharges: 50000,
          otherCharges: null,
          haltingCharges: null,
          advance: null,
          customCharges: [
            { name: 'Escort Charges', amount: 1500 },
            { name: 'Weighment Charges', amount: 350 },
          ],
          rate: null,
          amount: 51850,
        },
      ],
      totals: {
        freightTotal: 50000,
        otherChargesTotal: 0,
        haltingTotal: 0,
        advanceTotal: 0,
        grandTotal: 51850,
      },
      totalInWords: 'Fifty One Thousand Eight Hundred Fifty Rupees Only',
    };

    const html = generateBillHtml(fixtureWithCustomCharges);

    // Dynamic columns for Escort Charges and Weighment Charges
    expect(html).toContain('Escort Charges<br>(INR)');
    expect(html).toContain('Weighment Charges<br>(INR)');
    expect(html).toContain('1,500.00');
    expect(html).toContain('350.00');
    expect(html).toContain('51,850.00');

    // Sign and seal spacing and size assertions
    expect(html).toContain('gap: 4px;');
    expect(html).toContain('width: 148px; height: 87px;');
    expect(html).toContain('width: 102px; height: 102px;');
  });

  it('generates an in-memory PDF buffer with valid %PDF- header and strictly 1 single page', async () => {
    const html = generateBillHtml(TEST_BILL_FIXTURE);
    const buffer = await generateBillPdfBuffer(html);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const magicHeader = buffer.slice(0, 5).toString();
    expect(magicHeader).toBe('%PDF-');

    // Verify PDF is strictly 1 single page (no overflow to page 2)
    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBe(1);
  }, 30000);
});
