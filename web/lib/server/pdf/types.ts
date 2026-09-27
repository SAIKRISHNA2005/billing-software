export interface BillChargeItem {
  sNo?: number;
  description: string;
  freightCharges?: number | null;
  otherCharges?: number | null;
  haltingCharges?: number | null;
  advance?: number | null;
  rate?: number | null;
  amount: number;
}

export interface BillData {
  id: string;
  billNumber: string;
  billDate: string; // Formatted as DD-MM-YYYY
  rawDate?: string;
  financialYear: string;
  status: string;

  // Billed To Section (strictly NO GST/PAN)
  client: {
    id?: string;
    name: string;
    address: string;
  };

  // Company Details
  company: {
    id?: string;
    name: string;
    address: string;
    gstin: string;
    pan: string;
    phone?: string;
    email?: string;
  };

  // Bill Details Section
  loadType: 'Import' | 'Export' | 'Empty' | 'Offload' | 'Flatrack' | string;
  containerFrom: string;
  containerTo: string;
  routeText: string;

  truckCount20: number;
  truckCount40: number;

  truckNumbers: string[];
  containerNumbers: string[];

  // Dynamic Charges Table
  charges: BillChargeItem[];

  // Column Totals
  totals: {
    freightTotal: number;
    otherChargesTotal: number;
    haltingTotal: number;
    advanceTotal: number;
    rateTotal?: number;
    grandTotal: number;
  };

  // Number to words
  totalInWords: string;

  // Static Asset Overrides (optional base64 or file paths)
  assets?: {
    headerImage?: string;
    sealImage?: string;
    signatureImage?: string;
  };
}
