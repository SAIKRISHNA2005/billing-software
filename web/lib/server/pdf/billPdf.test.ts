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
    expect(html).toContain('gap: 0px;');
    expect(html).toContain('width: 140px; height: 85px;');
    expect(html).toContain('width: 98px; height: 98px;');
    expect(html).toContain('margin-left: -22px;');
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

  it('strictly contains high-density table with 7 dynamic columns within 100% width and 1 page', async () => {
    const highDensityBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'TRUCK NUMBER\tCONTAINER NUMBER\nTN04JK7890\tCMAU1122334',
          freightCharges: 38000,
          freightFormula: '1 X 38,000.00',
          haltingCharges: 1500,
          haltingFormula: '1 Day X 1,500.00',
          otherCharges: 2500,
          advance: 3500,
          customCharges: [
            { name: 'Heavy Haul Flattrack Transport (Container CMAU1122334 - 40 FT FR, 26.8 MT)', amount: 38000 },
            { name: 'Plant Detention Charges (1 Day)', amount: 1500 },
            { name: 'Special Cargo Handling & Escort Charges', amount: 2500 },
          ],
          rate: null,
          amount: 80000,
        },
      ],
      totals: {
        freightTotal: 38000,
        haltingTotal: 1500,
        otherChargesTotal: 2500,
        advanceTotal: 3500,
        grandTotal: 80000,
      },
      totalInWords: 'Rupees Eighty Thousand Only',
    };

    const html = generateBillHtml(highDensityBill);

    // Verify CSS enforcement for containment
    expect(html).toContain('table-layout: fixed !important;');
    expect(html).toContain('overflow: hidden;');
    expect(html).toContain('<colgroup>');

    // Verify all 7 dynamic columns and Amount (INR) exist in table
    expect(html).toContain('Freight Charges');
    expect(html).toContain('Halting Charges');
    expect(html).toContain('Other Charges');
    expect(html).toContain('Heavy Haul Flattrack Transport');
    expect(html).toContain('Plant Detention Charges');
    expect(html).toContain('Special Cargo Handling & Escort Charges');
    expect(html).toContain('Advance Paid');
    expect(html).toContain('Amount<br>(INR)');

    // Verify single-page PDF generation even with long custom column titles
    const buffer = await generateBillPdfBuffer(html);
    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBe(1);
  }, 30000);

  // =========================================================================
  // DYNAMIC COLUMN UPDATION TEST CASES (Requested by User)
  // =========================================================================

  // Test Case 1: Only normal charges present (Freight, Halting, Other, Advance) without ANY custom charges
  it('Dynamic Columns Test 1: Only normal charges present without custom charges', () => {
    const normalOnlyBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Standard Freight Transportation\nContainer: TEMU6210099',
          freightCharges: 25000,
          freightFormula: '1 X 25,000.00',
          haltingCharges: 1500,
          haltingFormula: '1 Day X 1,500.00',
          otherCharges: 2000,
          otherFormula: '2,000.00',
          advance: 5000,
          customCharges: [],
          rate: null,
          amount: 23500, // 25000 + 1500 + 2000 - 5000
        },
      ],
      totals: {
        freightTotal: 25000,
        haltingTotal: 1500,
        otherChargesTotal: 2000,
        advanceTotal: 5000,
        grandTotal: 23500,
      },
      totalInWords: 'Twenty Three Thousand Five Hundred Only',
    };

    const html = generateBillHtml(normalOnlyBill);

    // Standard columns MUST exist
    expect(html).toContain('Freight Charges<br>(INR)');
    expect(html).toContain('Halting Charges<br>(INR)');
    expect(html).toContain('Other Charges<br>(INR)');
    expect(html).toContain('Advance Paid<br>(Deduction)');
    expect(html).toContain('Amount<br>(INR)');

    // Row values must match
    expect(html).toContain('25,000.00');
    expect(html).toContain('1,500.00');
    expect(html).toContain('2,000.00');
    expect(html).toContain('- 5,000.00');
    expect(html).toContain('23,500.00');

    // No custom columns or placeholder headers should exist
    expect(html).not.toContain('custom_');
    expect(html).not.toContain('Custom Charge');
  });

  // Test Case 2: Normal charges present + 2 custom charges (Toll Charges and Weighment Charges)
  it('Dynamic Columns Test 2: Normal charges + 2 custom charges (Toll and Weighment)', () => {
    const normalPlusCustomBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Container Movement ZIRCON to GODREJ',
          freightCharges: 30000,
          freightFormula: '1 X 30,000.00',
          haltingCharges: 2000,
          haltingFormula: null,
          otherCharges: null,
          advance: 3000,
          customCharges: [
            { name: 'Toll Charges', amount: 1200 },
            { name: 'Weighment Charges', amount: 450 },
          ],
          rate: null,
          amount: 30650, // 30000 + 2000 + 1200 + 450 - 3000
        },
      ],
      totals: {
        freightTotal: 30000,
        haltingTotal: 2000,
        otherChargesTotal: 0,
        advanceTotal: 3000,
        grandTotal: 30650,
      },
      totalInWords: 'Thirty Thousand Six Hundred Fifty Only',
    };

    const html = generateBillHtml(normalPlusCustomBill);

    // Dynamic columns for standard charges
    expect(html).toContain('Freight Charges<br>(INR)');
    expect(html).toContain('Halting Charges<br>(INR)');
    expect(html).toContain('Advance Paid<br>(Deduction)');

    // 2 newly discovered custom columns MUST exist in table headers
    expect(html).toContain('Toll Charges<br>(INR)');
    expect(html).toContain('Weighment Charges<br>(INR)');

    // Row cell values
    expect(html).toContain('1,200.00');
    expect(html).toContain('450.00');
    expect(html).toContain('30,650.00');

    // Footer totals must contain the custom column sums
    expect(html).toContain('1,200.00');
    expect(html).toContain('450.00');
    expect(html).toContain('30,650.00');
  });

  // Test Case 3: Only custom charges present (0 Freight, 0 Halting, 0 Other, 0 Advance)
  it('Dynamic Columns Test 3: Only custom charges present without any standard charges', () => {
    const customOnlyBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Special Site Services\nContainer: MSKU1673779',
          freightCharges: 0,
          freightFormula: undefined,
          haltingCharges: 0,
          haltingFormula: undefined,
          otherCharges: 0,
          otherFormula: undefined,
          advance: 0,
          customCharges: [
            { name: 'Escort Charges', amount: 4500 },
            { name: 'Loading Extra Charges', amount: 2500 },
          ],
          rate: null,
          amount: 7000, // 4500 + 2500
        },
      ],
      totals: {
        freightTotal: 0,
        haltingTotal: 0,
        otherChargesTotal: 0,
        advanceTotal: 0,
        grandTotal: 7000,
      },
      totalInWords: 'Seven Thousand Only',
    };

    const html = generateBillHtml(customOnlyBill);

    // Standard columns with 0 values MUST NOT be included when custom charges exist
    expect(html).not.toContain('Freight Charges<br>(INR)');
    expect(html).not.toContain('Halting Charges<br>(INR)');
    expect(html).not.toContain('Other Charges<br>(INR)');
    expect(html).not.toContain('Advance Paid<br>(Deduction)');

    // ONLY the custom columns and Amount (INR) must be created
    expect(html).toContain('Escort Charges<br>(INR)');
    expect(html).toContain('Loading Extra Charges<br>(INR)');
    expect(html).toContain('Amount<br>(INR)');

    // Values in row and footer
    expect(html).toContain('4,500.00');
    expect(html).toContain('2,500.00');
    expect(html).toContain('7,000.00');
  });

  // Test Case 4: Multiple rows with mixed custom charges across rows
  it('Dynamic Columns Test 4: Multiple rows with sparse/mixed custom charges across rows', () => {
    const multiRowMixedBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Trip 1: Enq #101',
          freightCharges: 15000,
          freightFormula: '1 X 15,000.00',
          customCharges: [
            { name: 'Toll Charges', amount: 800 },
          ],
          rate: null,
          amount: 15800,
        },
        {
          sNo: 2,
          description: 'Trip 2: Enq #102',
          freightCharges: 18000,
          freightFormula: '1 X 18,000.00',
          customCharges: [
            { name: 'Escort Charges', amount: 2000 },
          ],
          rate: null,
          amount: 20000,
        },
        {
          sNo: 3,
          description: 'Trip 3: Enq #103',
          freightCharges: 12000,
          freightFormula: '1 X 12,000.00',
          customCharges: [
            { name: 'Toll Charges', amount: 800 },
            { name: 'Escort Charges', amount: 2000 },
          ],
          rate: null,
          amount: 14800,
        },
      ],
      totals: {
        freightTotal: 45000,
        haltingTotal: 0,
        otherChargesTotal: 0,
        advanceTotal: 0,
        grandTotal: 50600, // 45000 + 1600 (Toll) + 4000 (Escort)
      },
      totalInWords: 'Fifty Thousand Six Hundred Only',
    };

    const html = generateBillHtml(multiRowMixedBill);

    // Verify both unique custom charges are discovered as columns
    expect(html).toContain('Toll Charges<br>(INR)');
    expect(html).toContain('Escort Charges<br>(INR)');

    // Verify row description strictly formats TRUCK NUMBER and CONTAINER NUMBER table
    expect(html).toContain('TRUCK NUMBER');
    expect(html).toContain('CONTAINER NUMBER');
    expect(html).toContain('TN20BZ4732');
    expect(html).toContain('TEMU6210099');

    // Column totals in footer: Toll total = 1,600, Escort total = 4,000, Grand Total = 50,600
    expect(html).toContain('1,600.00');
    expect(html).toContain('4,000.00');
    expect(html).toContain('50,600.00');
  });

  // Test Case 5: End-to-end PDF generation for only custom charges bill
  it('Dynamic Columns Test 5: End-to-end PDF generation for custom-charges-only bill', async () => {
    const customOnlyBill: BillData = {
      ...TEST_BILL_FIXTURE,
      charges: [
        {
          sNo: 1,
          description: 'Special Escort & Offload Operation',
          freightCharges: 0,
          customCharges: [
            { name: 'Custom Clearance Escort', amount: 5000 },
            { name: 'Crane Offload Assistance', amount: 3500 },
          ],
          rate: null,
          amount: 8500,
        },
      ],
      totals: {
        freightTotal: 0,
        haltingTotal: 0,
        otherChargesTotal: 0,
        advanceTotal: 0,
        grandTotal: 8500,
      },
      totalInWords: 'Eight Thousand Five Hundred Only',
    };

    const html = generateBillHtml(customOnlyBill);
    const buffer = await generateBillPdfBuffer(html);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const magicHeader = buffer.slice(0, 5).toString();
    expect(magicHeader).toBe('%PDF-');

    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBe(1);
  }, 30000);
});

