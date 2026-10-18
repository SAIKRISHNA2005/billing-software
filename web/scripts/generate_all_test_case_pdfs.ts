import fs from 'fs';
import path from 'path';
import { generateBillHtml } from '../lib/server/pdf/billTemplate';
import { generateBillPdfBuffer } from '../lib/server/pdf/billPdfGenerator';
import { BillData } from '../lib/server/pdf/types';

const BASE_BILL_FIXTURE: BillData = {
  id: 'BIL-TEST-001',
  billNumber: '231/2026-27',
  billDate: '18-10-2026',
  financialYear: '2026-27',
  status: 'PROCESSED',
  client: {
    name: 'SIJA LOGISTICS PVT. LTD.',
    address: '#37/24 | Narayana Sarang Garden Street,\nParrys, Chennai - 600 001.',
    gstin: '33AABCS1429B1Z1',
    pan: 'AABCS1429B',
  },
  company: {
    id: 'CMP-001',
    name: 'SRI PONNIAMMAN TRANS',
    address: 'No. 12/1, Coral Merchant Street, Chennai - 600 001.',
    gstin: '33ASLPD2964M1ZH',
    pan: 'ASLPD2964M',
    phone: 'Tel: 42061100, Cell : 99417 80675',
    email: 'dharmasriponniammantrans@gmail.com',
    bankName: 'HDFC BANK',
    accountNo: '50200012345678',
    ifscCode: 'HDFC0001234',
    branch: 'PARRYS, CHENNAI',
  },
  loadType: 'Export',
  containerFrom: 'ZIRCON',
  containerTo: 'GODREJ AMBATTUR',
  routeText: 'ZIRCON TO GODREJ AMBATTUR',
  truckCount20: 3,
  truckCount40: 6,
  truckNumbers: ['TN20BZ4732', 'TN04Q7661'],
  containerNumbers: ['TEMU6210099', 'MSKU1673779'],
  charges: [],
  totals: {
    freightTotal: 0,
    otherChargesTotal: 0,
    haltingTotal: 0,
    advanceTotal: 0,
    grandTotal: 0,
  },
  totalInWords: 'Zero Rupees Only',
};

// 1. TestCase 1: Normal charges only (Freight, Halting, Other, Advance - NO custom charges)
const testCase1_NormalOnly: BillData = {
  ...BASE_BILL_FIXTURE,
  id: 'BIL-TEST-01',
  billNumber: 'TC1-NORMAL-ONLY',
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

// 2. TestCase 2: Normal charges present + 2 custom charges (Toll Charges & Weighment Charges)
const testCase2_NormalPlusCustom: BillData = {
  ...BASE_BILL_FIXTURE,
  id: 'BIL-TEST-02',
  billNumber: 'TC2-NORMAL-PLUS-2-CUSTOM',
  charges: [
    {
      sNo: 1,
      description: 'Container Movement ZIRCON to GODREJ AMBATTUR\nTruck: TN20BZ4732 | Container: TEMU6210099',
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

// 3. TestCase 3: ONLY custom charges (0 Freight, 0 Halting, 0 Other, 0 Advance)
const testCase3_OnlyCustom: BillData = {
  ...BASE_BILL_FIXTURE,
  id: 'BIL-TEST-03',
  billNumber: 'TC3-ONLY-CUSTOM-CHARGES',
  charges: [
    {
      sNo: 1,
      description: 'Special Escort & Site Loading Assistance\nContainer: MSKU1673779 (No Freight Applicable)',
      freightCharges: 0,
      haltingCharges: 0,
      otherCharges: 0,
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

// 4. TestCase 4: Multiple rows with mixed custom charges across rows
const testCase4_MultiRowMixed: BillData = {
  ...BASE_BILL_FIXTURE,
  id: 'BIL-TEST-04',
  billNumber: 'TC4-MULTIROW-MIXED-CUSTOM',
  charges: [
    {
      sNo: 1,
      description: 'Consignment Trip 1 - Enq #ENQ-10041\nTruck: TN04Q7661 | Cont: TEMU6210099',
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
      description: 'Consignment Trip 2 - Enq #ENQ-10042\nTruck: TN20BZ4732 | Cont: MSKU1673779',
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
      description: 'Consignment Trip 3 - Enq #ENQ-10043\nTruck: TN04AB9999 | Cont: MEDU9876543',
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

// 5. TestCase 5: High-density 7 dynamic columns (Freight + Halting + Other + 3 Custom + Advance)
const testCase5_HighDensity: BillData = {
  ...BASE_BILL_FIXTURE,
  id: 'BIL-TEST-05',
  billNumber: 'TC5-HIGH-DENSITY-7-COLS',
  charges: [
    {
      sNo: 1,
      description: 'Heavy Haul Flattrack Movement\nContainer: CMAU1122334 - 40 FT FR, 26.8 MT',
      freightCharges: 38000,
      freightFormula: '1 X 38,000.00',
      haltingCharges: 1500,
      haltingFormula: '1 Day X 1,500.00',
      otherCharges: 2500,
      advance: 3500,
      customCharges: [
        { name: 'Heavy Haul Surcharge', amount: 25000 },
        { name: 'Plant Detention Charges', amount: 1500 },
        { name: 'Escort Vehicle Charges', amount: 2500 },
      ],
      rate: null,
      amount: 67000, // 38000 + 1500 + 2500 + 25000 + 1500 + 2500 - 3500 = 67000
    },
  ],
  totals: {
    freightTotal: 38000,
    haltingTotal: 1500,
    otherChargesTotal: 2500,
    advanceTotal: 3500,
    grandTotal: 67000,
  },
  totalInWords: 'Sixty Seven Thousand Only',
};

const TEST_CASES = [
  { name: 'TestCase_1_Normal_Charges_Only', data: testCase1_NormalOnly },
  { name: 'TestCase_2_Normal_Plus_2_Custom_Charges', data: testCase2_NormalPlusCustom },
  { name: 'TestCase_3_Only_Custom_Charges', data: testCase3_OnlyCustom },
  { name: 'TestCase_4_MultiRow_Mixed_Custom_Charges', data: testCase4_MultiRowMixed },
  { name: 'TestCase_5_High_Density_7_Columns', data: testCase5_HighDensity },
];

async function run() {
  console.log('===============================================================');
  console.log('🚀 GENERATING PROOF PDF INVOICES FOR ALL 5 TESTCASES');
  console.log('===============================================================');

  const rootOutputDir = path.resolve(__dirname, '../../generated_test_pdfs');
  const webOutputDir = path.resolve(__dirname, '../public/test_pdfs');

  if (!fs.existsSync(rootOutputDir)) fs.mkdirSync(rootOutputDir, { recursive: true });
  if (!fs.existsSync(webOutputDir)) fs.mkdirSync(webOutputDir, { recursive: true });

  const generatedFiles: Array<{ name: string; path: string; size: number; pages: number }> = [];

  for (const tc of TEST_CASES) {
    console.log(`\n📄 Rendering ${tc.name}...`);
    const html = generateBillHtml(tc.data);
    const pdfBuffer = await generateBillPdfBuffer(html);

    const filename = `${tc.name}.pdf`;
    const rootPath = path.join(rootOutputDir, filename);
    const webPath = path.join(webOutputDir, filename);

    fs.writeFileSync(rootPath, pdfBuffer);
    fs.writeFileSync(webPath, pdfBuffer);

    const magic = pdfBuffer.slice(0, 5).toString();
    const pageMatches = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

    console.log(`   ✅ Saved: ${rootPath}`);
    console.log(`   ✅ Public Web: ${webPath}`);
    console.log(`   📊 Size: ${pdfBuffer.length} bytes | Header: ${magic} | Pages: ${pageMatches}`);

    generatedFiles.push({
      name: tc.name,
      path: rootPath,
      size: pdfBuffer.length,
      pages: pageMatches,
    });
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 5 TESTCASE BILL PDFS SUCCESSFULLY GENERATED ON DISK!');
  console.log('===============================================================');
  console.table(generatedFiles);
}

run().catch((err) => {
  console.error('❌ Error generating test case PDFs:', err);
  process.exit(1);
});
