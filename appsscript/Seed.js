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
