/**
 * Transport & Logistics Management System (TMS)
 * Phase 3 - Development Seed Data
 */

function seedDevData() {
  // 1. Guard against running in production
  const env = PropertiesService.getScriptProperties().getProperty('ENV');
  if (env === 'production') {
    throw new Error('Safety Guard: seedDevData() cannot be executed when ENV=production!');
  }

  const scriptProps = PropertiesService.getScriptProperties();

  // 2. Ensure all sheets exist first
  createAllSheets();

  const now = new Date().toISOString();
  const summary = {
    users: 0,
    app_settings: 0,
    companies: 0,
    clients: 0,
    vendors: 0,
    number_sequences: 0,
  };

  // Helper for password hashing
  function createCredentials(plainPassword) {
    const salt = Utilities.getUuid().replace(/-/g, '');
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      salt + plainPassword,
      Utilities.Charset.UTF_8
    );
    const hash = digest
      .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
      .join('');
    return { salt, hash };
  }

  // 3. Seed Users
  const adminPass = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';
  const staffPass = scriptProps.getProperty('SEED_STAFF_PASSWORD') || 'Staff@12345';
  const accountsPass = scriptProps.getProperty('SEED_ACCOUNTS_PASSWORD') || 'Accounts@12345';

  const initialUsers = [
    { id: 'USR-001', name: 'System Administrator', email: 'admin@tms.local', pass: adminPass },
    { id: 'USR-002', name: 'Logistics Staff', email: 'staff@tms.local', pass: staffPass },
    { id: 'USR-003', name: 'Accounts Operator', email: 'accounts@tms.local', pass: accountsPass },
  ];

  const existingUsers = SheetRepo.getAllRows('users', true);
  for (const u of initialUsers) {
    if (!existingUsers.some((x) => x.email === u.email)) {
      const creds = createCredentials(u.pass);
      SheetRepo.insertRow('users', {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: creds.hash,
        salt: creds.salt,
        createdAt: now,
        updatedAt: now,
      });
      summary.users++;
    }
  }

  // 4. Seed App Settings (Single Row)
  const existingSettings = SheetRepo.getRowById('app_settings', 'DEFAULT');
  if (!existingSettings) {
    SheetRepo.insertRow('app_settings', {
      id: 'DEFAULT',
      companyName: 'SHREE TRANSPORT & LOGISTICS',
      address: 'Plot No. 45, Harbour Express Way, Chennai, Tamil Nadu - 600001',
      phone: '+91 98400 12345',
      email: 'billing@shreetransport.local',
      gstin: '33AAACS1234A1Z1',
      pan: 'AAACS1234A',
      sealFileId: '',
      sealViewUrl: '',
      signatureFileId: '',
      signatureViewUrl: '',
      enquiryStartNumber: 10001,
      billStartNumber: 1,
      updatedAt: now,
    });
    summary.app_settings++;
  }

  // 5. Seed Companies
  const initialCompanies = [
    {
      id: 'CMP-001',
      name: 'FIRST SOLAR',
      address: 'SIPCOT Industrial Park, Sriperumbudur, Tamil Nadu',
      contactPerson: 'K. Raman',
      phone: '+91 98410 11111',
      email: 'logistics@firstsolar.local',
      gstin: '33AAACF1111A1Z1',
      pan: 'AAACF1111A',
      active: true,
    },
    {
      id: 'CMP-002',
      name: 'VALEO',
      address: 'Oragadam Industrial Corridor, Kanchipuram, Tamil Nadu',
      contactPerson: 'M. Suresh',
      phone: '+91 98410 22222',
      email: 'dispatch@valeo.local',
      gstin: '33AAACV2222B1Z2',
      pan: 'AAACV2222B',
      active: true,
    },
  ];

  const existingCompanies = SheetRepo.getAllRows('companies', true);
  for (const c of initialCompanies) {
    if (!existingCompanies.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) {
      SheetRepo.insertRow('companies', c);
      summary.companies++;
    }
  }

  // 6. Seed Clients
  const initialClients = [
    {
      id: 'CLI-001',
      name: 'DHL Supply Chain',
      companyId: 'CMP-001',
      contactPerson: 'Arun Kumar',
      phone: '+91 98410 33333',
      email: 'transport@dhl.local',
      address: 'DHL Logistics Hub, Chennai Port Road',
      gstin: '33AAACD3333C1Z3',
      active: true,
    },
    {
      id: 'CLI-002',
      name: 'CEVA Logistics',
      companyId: 'CMP-002',
      contactPerson: 'P. Venkat',
      phone: '+91 98410 44444',
      email: 'operations@ceva.local',
      address: 'CEVA Freight Terminal, Ennore Express Road',
      gstin: '33AAACC4444D1Z4',
      active: true,
    },
  ];

  const existingClients = SheetRepo.getAllRows('clients', true);
  for (const cl of initialClients) {
    if (!existingClients.some((x) => x.name.toLowerCase() === cl.name.toLowerCase())) {
      SheetRepo.insertRow('clients', cl);
      summary.clients++;
    }
  }

  // 7. Seed Vendor
  const initialVendors = [
    {
      id: 'VND-001',
      name: 'SPT Transports',
      contactPerson: 'S. Palani',
      phone: '+91 98410 55555',
      email: 'accounts@spttransports.local',
      address: '14, Lorry Stand Road, Madhavaram, Chennai',
      pan: 'AAACS5555E',
      bankDetails: 'HDFC Bank, Madhavaram Branch, A/C: 50200012345678, IFSC: HDFC0001234',
      active: true,
    },
  ];

  const existingVendors = SheetRepo.getAllRows('vendors', true);
  for (const v of initialVendors) {
    if (!existingVendors.some((x) => x.name.toLowerCase() === v.name.toLowerCase())) {
      SheetRepo.insertRow('vendors', v);
      summary.vendors++;
    }
  }

  // 8. Seed Number Sequences
  const currentFy = getFinancialYear();
  const initialSequences = [
    { sequenceKey: 'enquiry', financialYear: 'ALL', currentValue: 10000, updatedAt: now },
    { sequenceKey: `txn_${currentFy}`, financialYear: currentFy, currentValue: 0, updatedAt: now },
    { sequenceKey: `bill_${currentFy}`, financialYear: currentFy, currentValue: 0, updatedAt: now },
  ];

  const existingSeq = SheetRepo.getAllRows('number_sequences', true);
  for (const s of initialSequences) {
    if (!existingSeq.some((x) => x.sequenceKey === s.sequenceKey)) {
      SheetRepo.insertRow('number_sequences', s);
      summary.number_sequences++;
    }
  }

  Logger.log('Dev seed completed: ' + JSON.stringify(summary));
  return { success: true, summary };
}

/**
 * Clean Edge-Case Data Seeder
 * Wipes unwanted test records and inserts 11 comprehensive, real business records
 * covering all logistics edge cases across master, operations, billing, and reporting workbooks.
 */
function seedRealEdgeCaseData(payload) {
  payload = payload || {};
  createAllSheets();

  const nowIso = new Date().toISOString();
  const currentFy = getFinancialYear();

  // 1. Transactional Sheets to Wipe completely
  const transactionalSheets = [
    'enquiries',
    'movements',
    'stage_history',
    'bills',
    'bill_items',
    'bill_payments',
    'loading_expenses',
    'general_expenses',
    'vendor_payments',
    'audit_logs'
  ];

  transactionalSheets.forEach(function (sheetName) {
    try {
      SheetRepo.clearSheetData(sheetName);
    } catch (e) {
      Logger.log('Warning clearing ' + sheetName + ': ' + e.message);
    }
  });

  // 2. Clear and Reset Master Entities
  const masterSheets = ['companies', 'clients', 'vendors', 'vehicles', 'drivers', 'containers'];
  masterSheets.forEach(function (sheetName) {
    try {
      SheetRepo.clearSheetData(sheetName);
    } catch (e) {}
  });

  // 2a. Companies
  const companies = [
    {
      id: 'CMP-001',
      name: 'FIRST SOLAR',
      address: 'SIPCOT Industrial Park, Sriperumbudur, Tamil Nadu - 602105',
      contactPerson: 'K. Raman',
      phone: '+91 98410 11111',
      email: 'logistics@firstsolar.local',
      gstin: '33AAACF1111A1Z1',
      pan: 'AAACF1111A',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CMP-002',
      name: 'VALEO INDIA PVT LTD',
      address: 'Oragadam Industrial Corridor, Kanchipuram, Tamil Nadu - 602105',
      contactPerson: 'M. Suresh',
      phone: '+91 98410 22222',
      email: 'dispatch@valeo.local',
      gstin: '33AAACV2222B1Z2',
      pan: 'AAACV2222B',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CMP-003',
      name: 'RENAULT NISSAN AUTOMOTIVE',
      address: 'Plot No. 1, SIPCOT Oragadam, Chennai, Tamil Nadu - 602105',
      contactPerson: 'T. Krishnan',
      phone: '+91 98410 33333',
      email: 'logistics@renaultnissan.local',
      gstin: '33AAACR3333C1Z5',
      pan: 'AAACR3333C',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CMP-004',
      name: 'HYUNDAI MOTOR INDIA',
      address: 'Plot H-1, SIPCOT Industrial Park, Irungattukottai, Sriperumbudur - 602117',
      contactPerson: 'S. Balaji',
      phone: '+91 98410 44444',
      email: 'dispatch@hyundai.local',
      gstin: '33AAACH4444D1Z6',
      pan: 'AAACH4444D',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
  companies.forEach(function (c) { SheetRepo.insertRow('companies', c); });

  // 2b. Clients
  const clients = [
    {
      id: 'CLI-001',
      name: 'BLUE DART EXPRESS',
      companyId: 'CMP-001',
      contactPerson: 'Arun Kumar',
      phone: '+91 98410 12345',
      email: 'operations@bluedart.local',
      address: 'Blue Dart Aviation Cargo Terminal, Meenambakkam, Chennai - 600027',
      gstin: '33AAACB1234F1Z1',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CLI-002',
      name: 'TVS SUPPLY CHAIN SOLUTIONS',
      companyId: 'CMP-002',
      contactPerson: 'S. Ramanathan',
      phone: '+91 98410 23456',
      email: 'dispatch@tvsscs.local',
      address: 'TVS Logistics Park, Mannur, Sriperumbudur - 602105',
      gstin: '33AAACT5678G1Z2',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CLI-003',
      name: 'KUEHNE NAGEL PVT LTD',
      companyId: 'CMP-003',
      contactPerson: 'David Wilson',
      phone: '+91 98410 34567',
      email: 'sea.freight@kuehnenagel.local',
      address: 'Logistics Centre, Guindy Industrial Estate, Chennai - 600032',
      gstin: '33AAACK9012H1Z3',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CLI-004',
      name: 'SIJA LOGISTICS',
      companyId: 'CMP-001',
      contactPerson: 'J. Anbarasan',
      phone: '+91 98410 45678',
      email: 'transport@sijalogistics.local',
      address: 'CFS Facility, Ponneri High Road, Manali, Chennai - 600068',
      gstin: '33AAACS3456J1Z4',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'CLI-005',
      name: 'DHL SUPPLY CHAIN',
      companyId: 'CMP-004',
      contactPerson: 'Priya Sharma',
      phone: '+91 98410 56789',
      email: 'operations@dhl.local',
      address: 'DHL Global Forwarding, Alandur Road, Saidapet, Chennai - 600015',
      gstin: '33AAACD7890K1Z5',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
  clients.forEach(function (cl) { SheetRepo.insertRow('clients', cl); });

  // 2c. Vendors
  const vendors = [
    {
      id: 'VND-001',
      name: 'SPT Transports',
      contactPerson: 'S. Palani',
      phone: '+91 98410 55555',
      email: 'accounts@spttransports.local',
      address: '14, Lorry Stand Road, Madhavaram, Chennai',
      pan: 'AAACS5555E',
      bankDetails: 'HDFC Bank, Madhavaram, A/C: 50200012345678, IFSC: HDFC0001234',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'VND-002',
      name: 'Jai Logistics Fleet',
      contactPerson: 'K. Jayaram',
      phone: '+91 98410 88888',
      email: 'fleet@jailogistics.local',
      address: 'NH 48, Sriperumbudur Bypass, Sriperumbudur',
      pan: 'AAACJ8888F',
      bankDetails: 'ICICI Bank, Sriperumbudur, A/C: 001105001234, IFSC: ICIC0000011',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'VND-003',
      name: 'Southern Cargo Carriers',
      contactPerson: 'R. Murugan',
      phone: '+91 98410 99999',
      email: 'billing@southerncargo.local',
      address: 'Port Access Road, Ennore, Chennai',
      pan: 'AAACS9999G',
      bankDetails: 'SBI, Ennore Port, A/C: 30123456789, IFSC: SBIN0001234',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
  vendors.forEach(function (v) { SheetRepo.insertRow('vendors', v); });

  // 2d. Vehicles
  const vehicles = [
    { id: 'VEH-001', vehicleNumber: 'TN04AB1234', vehicleType: '40ft Flatbed Trailer', vendorId: 'VND-001', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'VEH-002', vehicleNumber: 'TN04CD5678', vehicleType: '20ft Container Trailer', vendorId: 'VND-001', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'VEH-003', vehicleNumber: 'TN04EF9012', vehicleType: '40ft High Cube Trailer', vendorId: 'VND-002', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'VEH-004', vehicleNumber: 'TN04GH3456', vehicleType: '40ft Flatbed Trailer', vendorId: 'VND-002', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'VEH-005', vehicleNumber: 'TN04JK7890', vehicleType: 'Heavy Haul Multi-Axle', vendorId: 'VND-003', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'VEH-006', vehicleNumber: 'TN04LM2345', vehicleType: '20ft Container Trailer', vendorId: 'VND-003', active: true, createdAt: nowIso, updatedAt: nowIso }
  ];
  vehicles.forEach(function (veh) { SheetRepo.insertRow('vehicles', veh); });

  // 2e. Drivers
  const drivers = [
    { id: 'DRV-001', name: 'M. Suresh', phone: '9841011111', licenseNumber: 'TN0420150001234', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'DRV-002', name: 'K. Raman', phone: '9841022222', licenseNumber: 'TN0420160002345', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'DRV-003', name: 'R. Kumar', phone: '9841033333', licenseNumber: 'TN0420170003456', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'DRV-004', name: 'P. Venkat', phone: '9841044444', licenseNumber: 'TN0420180004567', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'DRV-005', name: 'S. Palani', phone: '9841055555', licenseNumber: 'TN0420190005678', active: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'DRV-006', name: 'A. Arumugam', phone: '9841066666', licenseNumber: 'TN0420200006789', active: true, createdAt: nowIso, updatedAt: nowIso }
  ];
  drivers.forEach(function (d) { SheetRepo.insertRow('drivers', d); });

  // 2f. Containers
  const containers = [
    { id: 'CON-001', containerNumber: 'MSKU1234567', containerType: '40 FT HC', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-002', containerNumber: 'MEDU7654321', containerType: '20 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-003', containerNumber: 'TGHU9876543', containerType: '20 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-004', containerNumber: 'CMAU5432109', containerType: '40 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-005', containerNumber: 'TEMU8765432', containerType: '40 FT FR', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-006', containerNumber: 'MSKU9988112', containerType: '20 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-007', containerNumber: 'MEDU3344556', containerType: '40 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-008', containerNumber: 'TGHU6677889', containerType: '40 FT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-009', containerNumber: 'CMAU1122334', containerType: '40 FT FR', createdAt: nowIso, updatedAt: nowIso },
    { id: 'CON-010', containerNumber: 'TEMU4455667', containerType: '20 FT', createdAt: nowIso, updatedAt: nowIso }
  ];
  containers.forEach(function (c) { SheetRepo.insertRow('containers', c); });

  // 3. Reset Sequences
  try {
    SheetRepo.clearSheetData('number_sequences');
    const seqs = [
      { sequenceKey: 'enquiry', financialYear: 'ALL', currentValue: 10011, updatedAt: nowIso },
      { sequenceKey: 'txn_' + currentFy, financialYear: currentFy, currentValue: 11, updatedAt: nowIso },
      { sequenceKey: 'bill_' + currentFy, financialYear: currentFy, currentValue: 4, updatedAt: nowIso },
      { sequenceKey: 'invoice_2026', financialYear: '2026', currentValue: 11, updatedAt: nowIso }
    ];
    seqs.forEach(function (s) { SheetRepo.insertRow('number_sequences', s); });
  } catch (e) {}

  // 4. Seed 11 Real Edge-Case Enquiries & Movements
  const enquiriesData = [
    // Case 1: Fresh Booking / Unassigned (Stage: ENQUIRY_CREATED)
    {
      id: 'ENQ-10001',
      enquiryNumber: 10001,
      transactionNumber: 'TXN/2026-27/00001',
      date: '27-09-2026',
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      vehicleId: '',
      driverId: '',
      containerId: '',
      sealNumber: '-',
      stage: 'ENQUIRY_CREATED',
      vendorId: '',
      freightAmount: 16000,
      dieselAmount: 0,
      advanceAmount: 0,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10001',
      bookingDate: '27-09-2026',
      containerSize: '20 FT',
      noOfContainers: 1,
      weight: '14.5 MT',
      clientAddress: 'Blue Dart Aviation Cargo Terminal, Meenambakkam, Chennai',
      comments: 'Fresh booking: awaiting container discharge notification at Chennai Port',
      otherCharges: 0,
      shipmentDate: '28-09-2026',
      containerFrom: 'Chennai Port Trust Terminal 1',
      containerTo: 'First Solar Sriperumbudur Plant 2',
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '27-09-2026',
      truckCount20: 1,
      truckCount40: 0,
      billId: '',
      completedAt: '',
      active: true,
      createdAt: '2026-09-27T08:00:00.000Z',
      updatedAt: '2026-09-27T08:00:00.000Z'
    },
    // Case 2: Vehicle & Driver Assigned (Stage: VEHICLE_ASSIGNED)
    {
      id: 'ENQ-10002',
      enquiryNumber: 10002,
      transactionNumber: 'TXN/2026-27/00002',
      date: '27-09-2026',
      companyId: 'CMP-002',
      clientId: 'CLI-002',
      loadingType: 'Export',
      vehicleId: 'VEH-001',
      driverId: 'DRV-001',
      containerId: 'CON-001',
      sealNumber: 'SL-VAL-48901',
      stage: 'VEHICLE_ASSIGNED',
      vendorId: 'VND-001',
      freightAmount: 22000,
      dieselAmount: 5000,
      advanceAmount: 2000,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10002',
      bookingDate: '27-09-2026',
      containerSize: '40 FT HC',
      noOfContainers: 1,
      weight: '22.0 MT',
      clientAddress: 'TVS Logistics Park, Mannur, Sriperumbudur',
      comments: 'Driver dispatched with 40 FT trailer to Valeo Oragadam plant',
      otherCharges: 0,
      shipmentDate: '27-09-2026',
      containerFrom: 'Valeo Oragadam Facility',
      containerTo: 'DP World Chennai Port',
      invoiceNumber: 'INV-2026-002',
      invoiceDate: '27-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: '',
      completedAt: '',
      active: true,
      createdAt: '2026-09-27T09:30:00.000Z',
      updatedAt: '2026-09-27T10:00:00.000Z'
    },
    // Case 3: In Transit (Stage: CONTAINER_MOVEMENT)
    {
      id: 'ENQ-10003',
      enquiryNumber: 10003,
      transactionNumber: 'TXN/2026-27/00003',
      date: '26-09-2026',
      companyId: 'CMP-003',
      clientId: 'CLI-003',
      loadingType: 'Import',
      vehicleId: 'VEH-002',
      driverId: 'DRV-002',
      containerId: 'CON-002',
      sealNumber: 'SL-RN-99210',
      stage: 'CONTAINER_MOVEMENT',
      vendorId: 'VND-001',
      freightAmount: 19500,
      dieselAmount: 4000,
      advanceAmount: 1500,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10003',
      bookingDate: '26-09-2026',
      containerSize: '20 FT',
      noOfContainers: 1,
      weight: '18.2 MT',
      clientAddress: 'Logistics Centre, Guindy Industrial Estate, Chennai',
      comments: 'Loaded at port, gate pass printed, currently en-route to plant',
      otherCharges: 0,
      shipmentDate: '26-09-2026',
      containerFrom: 'Adani Kattupalli Port',
      containerTo: 'Renault Nissan Oragadam',
      invoiceNumber: 'INV-2026-003',
      invoiceDate: '26-09-2026',
      truckCount20: 1,
      truckCount40: 0,
      billId: '',
      completedAt: '',
      active: true,
      createdAt: '2026-09-26T07:30:00.000Z',
      updatedAt: '2026-09-26T15:45:00.000Z'
    },
    // Case 4: Completed Job - Ready for Billing / Standard 20 FT (Stage: COMPLETED)
    {
      id: 'ENQ-10004',
      enquiryNumber: 10004,
      transactionNumber: 'TXN/2026-27/00004',
      date: '26-09-2026',
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      vehicleId: 'VEH-003',
      driverId: 'DRV-003',
      containerId: 'CON-003',
      sealNumber: 'SL-FS-33120',
      stage: 'COMPLETED',
      vendorId: 'VND-002',
      freightAmount: 18000,
      dieselAmount: 4200,
      advanceAmount: 2000,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10004',
      bookingDate: '26-09-2026',
      containerSize: '20 FT',
      noOfContainers: 1,
      weight: '16.0 MT',
      clientAddress: 'Blue Dart Aviation Cargo Terminal, Meenambakkam, Chennai',
      comments: 'Delivered at First Solar. POD received with clean stamp. Unbilled.',
      otherCharges: 0,
      shipmentDate: '26-09-2026',
      containerFrom: 'Chennai Port',
      containerTo: 'First Solar Sriperumbudur',
      invoiceNumber: 'INV-2026-004',
      invoiceDate: '26-09-2026',
      truckCount20: 1,
      truckCount40: 0,
      billId: '',
      completedAt: '2026-09-26T18:00:00.000Z',
      active: true,
      createdAt: '2026-09-26T08:00:00.000Z',
      updatedAt: '2026-09-26T18:00:00.000Z'
    },
    // Case 5: Completed Job - Ready for Billing / Halting ₹3,000 + Other Charges ₹1,500 (Stage: COMPLETED)
    {
      id: 'ENQ-10005',
      enquiryNumber: 10005,
      transactionNumber: 'TXN/2026-27/00005',
      date: '25-09-2026',
      companyId: 'CMP-002',
      clientId: 'CLI-002',
      loadingType: 'Export',
      vehicleId: 'VEH-004',
      driverId: 'DRV-004',
      containerId: 'CON-004',
      sealNumber: 'SL-VAL-88219',
      stage: 'COMPLETED',
      vendorId: 'VND-002',
      freightAmount: 25000,
      dieselAmount: 6000,
      advanceAmount: 3000,
      extraAdvance: 0,
      haltingDays: 2,
      haltingAmount: 3000,
      bonus: 0,
      bookingNumber: 'BK-10005',
      bookingDate: '25-09-2026',
      containerSize: '40 FT',
      noOfContainers: 1,
      weight: '24.5 MT',
      clientAddress: 'TVS Logistics Park, Mannur, Sriperumbudur',
      comments: '2 days plant detention halting charges @ 1500/day + weighbridge charges',
      otherCharges: 1500,
      shipmentDate: '25-09-2026',
      containerFrom: 'Valeo Oragadam',
      containerTo: 'Ennore Port CFS',
      invoiceNumber: 'INV-2026-005',
      invoiceDate: '25-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: '',
      completedAt: '2026-09-27T11:30:00.000Z',
      active: true,
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-27T11:30:00.000Z'
    },
    // Case 6: Completed Job - Ready for Billing / Heavy Haul 40 FT FR, 29.2 MT (Stage: COMPLETED)
    {
      id: 'ENQ-10006',
      enquiryNumber: 10006,
      transactionNumber: 'TXN/2026-27/00006',
      date: '25-09-2026',
      companyId: 'CMP-003',
      clientId: 'CLI-003',
      loadingType: 'Flattrack',
      vehicleId: 'VEH-005',
      driverId: 'DRV-005',
      containerId: 'CON-005',
      sealNumber: 'SL-RN-44012',
      stage: 'COMPLETED',
      vendorId: 'VND-003',
      freightAmount: 34000,
      dieselAmount: 8000,
      advanceAmount: 4000,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10006',
      bookingDate: '25-09-2026',
      containerSize: '40 FT FR',
      noOfContainers: 1,
      weight: '29.2 MT Heavy Machinery',
      clientAddress: 'Logistics Centre, Guindy Industrial Estate, Chennai',
      comments: 'Heavy haul multi-axle trailer with hydraulic escort permit',
      otherCharges: 3500,
      shipmentDate: '25-09-2026',
      containerFrom: 'Chennai Port Timber Terminal',
      containerTo: 'Renault Nissan Oragadam',
      invoiceNumber: 'INV-2026-006',
      invoiceDate: '25-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: '',
      completedAt: '2026-09-27T16:45:00.000Z',
      active: true,
      createdAt: '2026-09-25T14:00:00.000Z',
      updatedAt: '2026-09-27T16:45:00.000Z'
    },
    // Case 7: Billed Job - Bill 1/2026-27 / UNPAID (Stage: PROCESSED)
    {
      id: 'ENQ-10007',
      enquiryNumber: 10007,
      transactionNumber: 'TXN/2026-27/00007',
      date: '20-09-2026',
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      loadingType: 'Import',
      vehicleId: 'VEH-002',
      driverId: 'DRV-002',
      containerId: 'CON-006',
      sealNumber: 'SL-FS-22019',
      stage: 'PROCESSED',
      vendorId: 'VND-001',
      freightAmount: 20000,
      dieselAmount: 4500,
      advanceAmount: 2000,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10007',
      bookingDate: '20-09-2026',
      containerSize: '20 FT',
      noOfContainers: 1,
      weight: '15.0 MT',
      clientAddress: 'Blue Dart Aviation Cargo Terminal, Meenambakkam, Chennai',
      comments: 'Processed under Bill 1/2026-27 - Unpaid',
      otherCharges: 1000,
      shipmentDate: '20-09-2026',
      containerFrom: 'Chennai Port',
      containerTo: 'First Solar Sriperumbudur',
      invoiceNumber: 'INV-2026-007',
      invoiceDate: '20-09-2026',
      truckCount20: 1,
      truckCount40: 0,
      billId: 'BIL-10001',
      completedAt: '2026-09-20T17:00:00.000Z',
      active: true,
      createdAt: '2026-09-20T08:00:00.000Z',
      updatedAt: '2026-09-20T17:30:00.000Z'
    },
    // Case 8: Billed Job - Bill 2/2026-27 / Item 1 of 2 (Stage: PROCESSED)
    {
      id: 'ENQ-10008',
      enquiryNumber: 10008,
      transactionNumber: 'TXN/2026-27/00008',
      date: '21-09-2026',
      companyId: 'CMP-002',
      clientId: 'CLI-002',
      loadingType: 'Export',
      vehicleId: 'VEH-001',
      driverId: 'DRV-001',
      containerId: 'CON-007',
      sealNumber: 'SL-VAL-66124',
      stage: 'PROCESSED',
      vendorId: 'VND-001',
      freightAmount: 26000,
      dieselAmount: 5500,
      advanceAmount: 2500,
      extraAdvance: 0,
      haltingDays: 1,
      haltingAmount: 1500,
      bonus: 0,
      bookingNumber: 'BK-10008',
      bookingDate: '21-09-2026',
      containerSize: '40 FT',
      noOfContainers: 1,
      weight: '23.0 MT',
      clientAddress: 'TVS Logistics Park, Mannur, Sriperumbudur',
      comments: 'Processed under Bill 2/2026-27 - Partial Payment',
      otherCharges: 500,
      shipmentDate: '21-09-2026',
      containerFrom: 'Valeo Oragadam',
      containerTo: 'Chennai Port',
      invoiceNumber: 'INV-2026-008',
      invoiceDate: '21-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: 'BIL-10002',
      completedAt: '2026-09-22T10:00:00.000Z',
      active: true,
      createdAt: '2026-09-21T09:00:00.000Z',
      updatedAt: '2026-09-22T12:30:00.000Z'
    },
    // Case 8: Billed Job - Bill 2/2026-27 / Item 2 of 2 (Stage: PROCESSED)
    {
      id: 'ENQ-10009',
      enquiryNumber: 10009,
      transactionNumber: 'TXN/2026-27/00009',
      date: '21-09-2026',
      companyId: 'CMP-002',
      clientId: 'CLI-002',
      loadingType: 'Export',
      vehicleId: 'VEH-004',
      driverId: 'DRV-004',
      containerId: 'CON-008',
      sealNumber: 'SL-VAL-66125',
      stage: 'PROCESSED',
      vendorId: 'VND-002',
      freightAmount: 26500,
      dieselAmount: 5500,
      advanceAmount: 2500,
      extraAdvance: 0,
      haltingDays: 1,
      haltingAmount: 1500,
      bonus: 0,
      bookingNumber: 'BK-10009',
      bookingDate: '21-09-2026',
      containerSize: '40 FT',
      noOfContainers: 1,
      weight: '22.5 MT',
      clientAddress: 'TVS Logistics Park, Mannur, Sriperumbudur',
      comments: 'Processed under Bill 2/2026-27 - Partial Payment',
      otherCharges: 0,
      shipmentDate: '21-09-2026',
      containerFrom: 'Valeo Oragadam',
      containerTo: 'Chennai Port',
      invoiceNumber: 'INV-2026-009',
      invoiceDate: '21-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: 'BIL-10002',
      completedAt: '2026-09-22T12:00:00.000Z',
      active: true,
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-22T12:30:00.000Z'
    },
    // Case 9: Billed Job - Bill 3/2026-27 / PAID In Full (Stage: PROCESSED)
    {
      id: 'ENQ-10010',
      enquiryNumber: 10010,
      transactionNumber: 'TXN/2026-27/00010',
      date: '17-09-2026',
      companyId: 'CMP-003',
      clientId: 'CLI-003',
      loadingType: 'Flattrack',
      vehicleId: 'VEH-005',
      driverId: 'DRV-005',
      containerId: 'CON-009',
      sealNumber: 'SL-RN-11490',
      stage: 'PROCESSED',
      vendorId: 'VND-003',
      freightAmount: 38000,
      dieselAmount: 7500,
      advanceAmount: 3500,
      extraAdvance: 0,
      haltingDays: 1,
      haltingAmount: 1500,
      bonus: 0,
      bookingNumber: 'BK-10010',
      bookingDate: '17-09-2026',
      containerSize: '40 FT FR',
      noOfContainers: 1,
      weight: '26.8 MT',
      clientAddress: 'Logistics Centre, Guindy Industrial Estate, Chennai',
      comments: 'Processed under Bill 3/2026-27 - Fully Paid',
      otherCharges: 2500,
      shipmentDate: '17-09-2026',
      containerFrom: 'Ennore Port',
      containerTo: 'Renault Nissan Oragadam',
      invoiceNumber: 'INV-2026-010',
      invoiceDate: '17-09-2026',
      truckCount20: 0,
      truckCount40: 1,
      billId: 'BIL-10003',
      completedAt: '2026-09-18T15:00:00.000Z',
      active: true,
      createdAt: '2026-09-17T09:00:00.000Z',
      updatedAt: '2026-09-18T15:30:00.000Z'
    },
    // Case 10: Billed Job - Bill 4/2026-27 / 45-Days Overdue (Stage: PROCESSED)
    {
      id: 'ENQ-10011',
      enquiryNumber: 10011,
      transactionNumber: 'TXN/2026-27/00011',
      date: '14-08-2026',
      companyId: 'CMP-001',
      clientId: 'CLI-004',
      loadingType: 'Import',
      vehicleId: 'VEH-006',
      driverId: 'DRV-006',
      containerId: 'CON-010',
      sealNumber: 'SL-SJ-88014',
      stage: 'PROCESSED',
      vendorId: 'VND-003',
      freightAmount: 18500,
      dieselAmount: 4000,
      advanceAmount: 1500,
      extraAdvance: 0,
      haltingDays: 0,
      haltingAmount: 0,
      bonus: 0,
      bookingNumber: 'BK-10011',
      bookingDate: '14-08-2026',
      containerSize: '20 FT',
      noOfContainers: 1,
      weight: '16.5 MT',
      clientAddress: 'CFS Facility, Ponneri High Road, Manali, Chennai',
      comments: 'Processed under Bill 4/2026-27 - 45 days overdue (Ageing 31-60 days bucket)',
      otherCharges: 0,
      shipmentDate: '14-08-2026',
      containerFrom: 'Chennai Port',
      containerTo: 'Sija CFS Manali',
      invoiceNumber: 'INV-2026-011',
      invoiceDate: '14-08-2026',
      truckCount20: 1,
      truckCount40: 0,
      billId: 'BIL-10004',
      completedAt: '2026-08-14T17:30:00.000Z',
      active: true,
      createdAt: '2026-08-14T08:00:00.000Z',
      updatedAt: '2026-08-14T18:00:00.000Z'
    }
  ];

  enquiriesData.forEach(function (enq) {
    SheetRepo.insertRow('enquiries', enq);
  });

  // 4b. Movements Data for each Enquiry
  const movementsData = [
    {
      id: 'MOV-10001',
      enquiryId: 'ENQ-10001',
      companyInTime: '',
      companyOutTime: '',
      printInTime: '',
      printOutTime: '',
      portInTime: '',
      portOutTime: '',
      movementStatus: 'NOT_MOVED',
      shippingStatus: 'PENDING',
      createdAt: '2026-09-27T08:00:00.000Z',
      updatedAt: '2026-09-27T08:00:00.000Z'
    },
    {
      id: 'MOV-10002',
      enquiryId: 'ENQ-10002',
      companyInTime: '',
      companyOutTime: '',
      printInTime: '',
      printOutTime: '',
      portInTime: '',
      portOutTime: '',
      movementStatus: 'VEHICLE_ASSIGNED',
      shippingStatus: 'IN_PROGRESS',
      createdAt: '2026-09-27T09:30:00.000Z',
      updatedAt: '2026-09-27T10:00:00.000Z'
    },
    {
      id: 'MOV-10003',
      enquiryId: 'ENQ-10003',
      companyInTime: '2026-09-26 09:15',
      companyOutTime: '2026-09-26 13:40',
      printInTime: '2026-09-26 15:00',
      printOutTime: '2026-09-26 15:45',
      portInTime: '',
      portOutTime: '',
      movementStatus: 'IN_TRANSIT',
      shippingStatus: 'IN_TRANSIT',
      createdAt: '2026-09-26T07:30:00.000Z',
      updatedAt: '2026-09-26T15:45:00.000Z'
    },
    {
      id: 'MOV-10004',
      enquiryId: 'ENQ-10004',
      companyInTime: '2026-09-26 08:30',
      companyOutTime: '2026-09-26 11:30',
      printInTime: '2026-09-26 13:00',
      printOutTime: '2026-09-26 13:45',
      portInTime: '2026-09-26 16:30',
      portOutTime: '2026-09-26 18:00',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-26T08:00:00.000Z',
      updatedAt: '2026-09-26T18:00:00.000Z'
    },
    {
      id: 'MOV-10005',
      enquiryId: 'ENQ-10005',
      companyInTime: '2026-09-25 10:00',
      companyOutTime: '2026-09-27 08:00',
      printInTime: '2026-09-27 09:15',
      printOutTime: '2026-09-27 09:50',
      portInTime: '2026-09-27 10:45',
      portOutTime: '2026-09-27 11:30',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-27T11:30:00.000Z'
    },
    {
      id: 'MOV-10006',
      enquiryId: 'ENQ-10006',
      companyInTime: '2026-09-26 14:00',
      companyOutTime: '2026-09-27 12:00',
      printInTime: '2026-09-27 13:30',
      printOutTime: '2026-09-27 14:15',
      portInTime: '2026-09-27 15:30',
      portOutTime: '2026-09-27 16:45',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-25T14:00:00.000Z',
      updatedAt: '2026-09-27T16:45:00.000Z'
    },
    {
      id: 'MOV-10007',
      enquiryId: 'ENQ-10007',
      companyInTime: '2026-09-20 09:00',
      companyOutTime: '2026-09-20 12:00',
      printInTime: '2026-09-20 13:15',
      printOutTime: '2026-09-20 14:00',
      portInTime: '2026-09-20 15:30',
      portOutTime: '2026-09-20 17:00',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-20T08:00:00.000Z',
      updatedAt: '2026-09-20T17:00:00.000Z'
    },
    {
      id: 'MOV-10008',
      enquiryId: 'ENQ-10008',
      companyInTime: '2026-09-21 11:00',
      companyOutTime: '2026-09-22 08:00',
      printInTime: '2026-09-22 09:00',
      printOutTime: '2026-09-22 09:30',
      portInTime: '2026-09-22 09:45',
      portOutTime: '2026-09-22 10:00',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-21T09:00:00.000Z',
      updatedAt: '2026-09-22T10:00:00.000Z'
    },
    {
      id: 'MOV-10009',
      enquiryId: 'ENQ-10009',
      companyInTime: '2026-09-21 12:30',
      companyOutTime: '2026-09-22 09:30',
      printInTime: '2026-09-22 10:30',
      printOutTime: '2026-09-22 11:15',
      portInTime: '2026-09-22 11:30',
      portOutTime: '2026-09-22 12:00',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z'
    },
    {
      id: 'MOV-10010',
      enquiryId: 'ENQ-10010',
      companyInTime: '2026-09-17 14:00',
      companyOutTime: '2026-09-18 10:00',
      printInTime: '2026-09-18 11:30',
      printOutTime: '2026-09-18 12:15',
      portInTime: '2026-09-18 13:45',
      portOutTime: '2026-09-18 15:00',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-09-17T09:00:00.000Z',
      updatedAt: '2026-09-18T15:00:00.000Z'
    },
    {
      id: 'MOV-10011',
      enquiryId: 'ENQ-10011',
      companyInTime: '2026-08-14 09:30',
      companyOutTime: '2026-08-14 12:30',
      printInTime: '2026-08-14 13:45',
      printOutTime: '2026-08-14 14:30',
      portInTime: '2026-08-14 16:00',
      portOutTime: '2026-08-14 17:30',
      movementStatus: 'COMPLETED',
      shippingStatus: 'DELIVERED',
      createdAt: '2026-08-14T08:00:00.000Z',
      updatedAt: '2026-08-14T17:30:00.000Z'
    }
  ];

  movementsData.forEach(function (mov) {
    SheetRepo.insertRow('movements', mov);
  });

  // 4c. Stage History
  enquiriesData.forEach(function (e) {
    SheetRepo.insertRow('stage_history', {
      id: 'STG-' + e.enquiryNumber,
      enquiryId: e.id,
      fromStage: '',
      toStage: e.stage,
      direction: 'FORWARD',
      remarks: 'Seeded record state: ' + e.stage,
      timestamp: e.updatedAt || e.createdAt
    });
  });

  // 5. Seed 4 Processed Bills
  const billsData = [
    {
      id: 'BIL-10001',
      billNumber: '1/2026-27',
      billSeq: 1,
      financialYear: '2026-27',
      status: 'PROCESSED',
      billingDate: '2026-09-20',
      companyId: 'CMP-001',
      clientId: 'CLI-001',
      totalAmount: 21000,
      paidAmount: 0,
      pendingAmount: 21000,
      outstandingAmount: 21000,
      paymentStatus: 'UNPAID',
      remarks: 'Transportation of 20 FT container for First Solar plant dispatch',
      processedAt: '2026-09-20T17:30:00.000Z',
      createdAt: '2026-09-20T17:00:00.000Z',
      updatedAt: '2026-09-20T17:30:00.000Z'
    },
    {
      id: 'BIL-10002',
      billNumber: '2/2026-27',
      billSeq: 2,
      financialYear: '2026-27',
      status: 'PROCESSED',
      billingDate: '2026-09-22',
      companyId: 'CMP-002',
      clientId: 'CLI-002',
      totalAmount: 56000,
      paidAmount: 30000,
      pendingAmount: 26000,
      outstandingAmount: 26000,
      paymentStatus: 'PARTIAL',
      remarks: 'Consolidated freight charges for 2 export containers with plant halting',
      processedAt: '2026-09-22T12:30:00.000Z',
      createdAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-25T11:00:00.000Z'
    },
    {
      id: 'BIL-10003',
      billNumber: '3/2026-27',
      billSeq: 3,
      financialYear: '2026-27',
      status: 'PROCESSED',
      billingDate: '2026-09-18',
      companyId: 'CMP-003',
      clientId: 'CLI-003',
      totalAmount: 42000,
      paidAmount: 42000,
      pendingAmount: 0,
      outstandingAmount: 0,
      paymentStatus: 'PAID',
      remarks: 'Special project 40 FT FR heavy haul container movement - Settled in full',
      processedAt: '2026-09-18T15:30:00.000Z',
      createdAt: '2026-09-18T15:00:00.000Z',
      updatedAt: '2026-09-24T14:00:00.000Z'
    },
    {
      id: 'BIL-10004',
      billNumber: '4/2026-27',
      billSeq: 4,
      financialYear: '2026-27',
      status: 'PROCESSED',
      billingDate: '2026-08-14',
      companyId: 'CMP-001',
      clientId: 'CLI-004',
      totalAmount: 18500,
      paidAmount: 0,
      pendingAmount: 18500,
      outstandingAmount: 18500,
      paymentStatus: 'UNPAID',
      remarks: 'Import container delivery to Sija CFS Manali - 45 days overdue',
      processedAt: '2026-08-14T18:00:00.000Z',
      createdAt: '2026-08-14T17:30:00.000Z',
      updatedAt: '2026-08-14T18:00:00.000Z'
    }
  ];

  billsData.forEach(function (b) { SheetRepo.insertRow('bills', b); });

  // 6. Seed Bill Line Items
  const billItemsData = [
    // Bill 1 items
    { id: 'BIT-10001', billId: 'BIL-10001', enquiryId: 'ENQ-10007', description: 'Transportation Charges (Container MSKU9988112 - 20 FT)', amount: 20000, sortOrder: 1, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10002', billId: 'BIL-10001', enquiryId: 'ENQ-10007', description: 'Port Gate & Handling Surcharge', amount: 1000, sortOrder: 2, createdAt: nowIso, updatedAt: nowIso },

    // Bill 2 items
    { id: 'BIT-10003', billId: 'BIL-10002', enquiryId: 'ENQ-10008', description: 'Transportation Charges (Container MEDU3344556 - 40 FT)', amount: 26000, sortOrder: 1, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10004', billId: 'BIL-10002', enquiryId: 'ENQ-10008', description: 'Halting & Detention Charges (1 Day @ 1,500)', amount: 1500, sortOrder: 2, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10005', billId: 'BIL-10002', enquiryId: 'ENQ-10009', description: 'Transportation Charges (Container TGHU6677889 - 40 FT)', amount: 26500, sortOrder: 3, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10006', billId: 'BIL-10002', enquiryId: 'ENQ-10009', description: 'Halting & Detention Charges (1 Day @ 1,500)', amount: 1500, sortOrder: 4, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10007', billId: 'BIL-10002', enquiryId: 'ENQ-10008', description: 'Weighbridge Certificate Fee', amount: 500, sortOrder: 5, createdAt: nowIso, updatedAt: nowIso },

    // Bill 3 items
    { id: 'BIT-10008', billId: 'BIL-10003', enquiryId: 'ENQ-10010', description: 'Heavy Haul Flattrack Transport (Container CMAU1122334 - 40 FT FR, 26.8 MT)', amount: 38000, sortOrder: 1, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10009', billId: 'BIL-10003', enquiryId: 'ENQ-10010', description: 'Plant Detention Charges (1 Day)', amount: 1500, sortOrder: 2, createdAt: nowIso, updatedAt: nowIso },
    { id: 'BIT-10010', billId: 'BIL-10003', enquiryId: 'ENQ-10010', description: 'Special Cargo Handling & Escort Charges', amount: 2500, sortOrder: 3, createdAt: nowIso, updatedAt: nowIso },

    // Bill 4 items
    { id: 'BIT-10011', billId: 'BIL-10004', enquiryId: 'ENQ-10011', description: 'Transportation Charges (Container TEMU4455667 - 20 FT)', amount: 18500, sortOrder: 1, createdAt: nowIso, updatedAt: nowIso }
  ];

  billItemsData.forEach(function (bi) { SheetRepo.insertRow('bill_items', bi); });

  // 7. Seed Bill Payments
  const paymentsData = [
    {
      id: 'PAY-10001',
      billId: 'BIL-10002',
      paymentDate: '2026-09-25',
      amount: 30000,
      mode: 'NEFT',
      paymentMode: 'NEFT',
      reference: 'HDFCN262500124',
      referenceNo: 'HDFCN262500124',
      notes: 'Advance 50% part payment against invoice 2/2026-27',
      createdAt: '2026-09-25T11:00:00.000Z',
      updatedAt: '2026-09-25T11:00:00.000Z'
    },
    {
      id: 'PAY-10002',
      billId: 'BIL-10003',
      paymentDate: '2026-09-24',
      amount: 42000,
      mode: 'RTGS',
      paymentMode: 'RTGS',
      reference: 'ICICR52026092401',
      referenceNo: 'ICICR52026092401',
      notes: 'Full settlement of invoice 3/2026-27',
      createdAt: '2026-09-24T14:00:00.000Z',
      updatedAt: '2026-09-24T14:00:00.000Z'
    }
  ];

  paymentsData.forEach(function (p) { SheetRepo.insertRow('bill_payments', p); });

  // 8. Seed Loading Expenses & General Expenses
  const loadingExpenses = [
    { id: 'LXP-10001', expenseDate: '2026-09-27', category: 'WEIGHBRIDGE', amount: 350, description: 'Electronic weighbridge gross & tare slip', enquiryId: 'ENQ-10005', vehicleId: 'VEH-004', source: 'CASH', createdAt: nowIso, updatedAt: nowIso },
    { id: 'LXP-10002', expenseDate: '2026-09-27', category: 'PORT_PASS', amount: 850, description: 'Port terminal entry permit pass', enquiryId: 'ENQ-10006', vehicleId: 'VEH-005', source: 'CASH', createdAt: nowIso, updatedAt: nowIso },
    { id: 'LXP-10003', expenseDate: '2026-09-26', category: 'CRANE_ASSIST', amount: 1500, description: 'Yard crane container placement fee', enquiryId: 'ENQ-10004', vehicleId: 'VEH-003', source: 'BANK', createdAt: nowIso, updatedAt: nowIso }
  ];
  loadingExpenses.forEach(function (lx) { SheetRepo.insertRow('loading_expenses', lx); });

  const generalExpenses = [
    { id: 'GXP-10001', expenseDate: '2026-09-27', category: 'FASTAG', amount: 5000, description: 'Fleet Fastag toll wallet recharge', createdAt: nowIso, updatedAt: nowIso },
    { id: 'GXP-10002', expenseDate: '2026-09-27', category: 'DRIVER_ALLOWANCE', amount: 1200, description: 'Night trip driver refreshment & batta', createdAt: nowIso, updatedAt: nowIso }
  ];
  generalExpenses.forEach(function (gx) { SheetRepo.insertRow('general_expenses', gx); });

  // 9. Trigger Initial Full Sync to all 3 Reporting Workbooks
  var syncResult = null;
  try {
    syncResult = ReportingSyncModule.initialFullSync({
      dailySpreadsheetId: payload.dailySpreadsheetId,
      companySpreadsheetId: payload.companySpreadsheetId || payload.clientSpreadsheetId,
      processedBillsSpreadsheetId: payload.processedBillsSpreadsheetId
    });
  } catch (syncErr) {
    Logger.log('Sync Error during seed: ' + syncErr.message);
    syncResult = { success: false, error: syncErr.message };
  }

  return {
    success: true,
    message: 'All old data cleared and 11 real edge-case records successfully seeded across all 4 workbooks!',
    summary: {
      companiesCount: companies.length,
      clientsCount: clients.length,
      vendorsCount: vendors.length,
      vehiclesCount: vehicles.length,
      driversCount: drivers.length,
      containersCount: containers.length,
      enquiriesCount: enquiriesData.length,
      movementsCount: movementsData.length,
      billsCount: billsData.length,
      billItemsCount: billItemsData.length,
      paymentsCount: paymentsData.length,
      loadingExpensesCount: loadingExpenses.length,
      generalExpensesCount: generalExpenses.length,
      syncResult: syncResult
    }
  };
}
