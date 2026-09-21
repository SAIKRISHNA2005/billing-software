/**
 * Transport & Logistics Management System (TMS)
 * Phase 5 - Master Data GAS Test Suite
 */

function testMasterDataSuite() {
  const suiteName = 'Master Data Management Suite';
  Logger.log('Starting ' + suiteName + '...');

  // Ensure test operator session exists
  const scriptProps = PropertiesService.getScriptProperties();
  const testPassword = scriptProps.getProperty('SEED_ADMIN_PASSWORD') || 'Admin@12345';
  const loginRes = AuthModule.login({ email: 'admin@tms.local', password: testPassword });
  const token = loginRes.token;

  // 1. Test Company Creation & Uniqueness
  TestHarness.test('Company: Create and duplicate rejection', function () {
    const uniqueName = 'TEST COMPANY ' + Utilities.getUuid().slice(0, 6).toUpperCase();
    const created = MasterDataModule.create('companies', {
      name: uniqueName,
      address: 'Test Address, Chennai',
      contactPerson: 'Manager',
      phone: '9840012345',
      email: 'test@company.local',
      gstin: '33AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
    }, token);

    TestHarness.assert(created.id && created.id.startsWith('CMP-'), 'Company ID should be prefixed with CMP-');
    TestHarness.assertEqual(created.name, uniqueName, 'Company name should match');
    TestHarness.assertEqual(created.active, true, 'Company should be active');

    // Attempt duplicate creation (case-insensitive)
    TestHarness.assertThrows(function () {
      MasterDataModule.create('companies', {
        name: uniqueName.toLowerCase(),
      }, token);
    }, 'Duplicate company name should be rejected');
  });

  // 2. Test Vehicle Formatting & Uniqueness
  TestHarness.test('Vehicle: Uppercase formatting and duplicate rejection', function () {
    const rawNumber = 'tn' + Math.floor(10 + Math.random() * 89) + 'ab' + Math.floor(1000 + Math.random() * 8999);
    const expectedUppercase = rawNumber.toUpperCase();

    const created = MasterDataModule.create('vehicles', {
      vehicleNumber: rawNumber,
      vehicleType: '40ft Flatbed Trailer',
    }, token);

    TestHarness.assertEqual(created.vehicleNumber, expectedUppercase, 'Vehicle number should be auto-uppercased');
    TestHarness.assertEqual(created.active, true, 'Vehicle should be active');

    // Duplicate check
    TestHarness.assertThrows(function () {
      MasterDataModule.create('vehicles', {
        vehicleNumber: rawNumber,
        vehicleType: '20ft Container Truck',
      }, token);
    }, 'Duplicate vehicle number should be rejected');

    // Invalid format check
    TestHarness.assertThrows(function () {
      MasterDataModule.create('vehicles', {
        vehicleNumber: 'INVALID_123',
        vehicleType: 'Trailer',
      }, token);
    }, 'Invalid vehicle number pattern should be rejected');
  });

  // 3. Test Driver Phone Validation
  TestHarness.test('Driver: 10-digit mobile number validation', function () {
    const randomSuffix = Math.floor(10000000 + Math.random() * 89999999);
    const validPhone = '98' + randomSuffix;

    const created = MasterDataModule.create('drivers', {
      name: 'Test Driver ' + randomSuffix,
      phone: validPhone,
      licenseNumber: 'TN0120200001234',
    }, token);

    TestHarness.assertEqual(created.phone, validPhone, 'Driver phone should match');

    // Invalid phone: too short
    TestHarness.assertThrows(function () {
      MasterDataModule.create('drivers', {
        name: 'Invalid Driver',
        phone: '12345',
      }, token);
    }, 'Short driver phone should be rejected');

    // Duplicate driver phone
    TestHarness.assertThrows(function () {
      MasterDataModule.create('drivers', {
        name: 'Another Driver',
        phone: validPhone,
      }, token);
    }, 'Duplicate driver phone should be rejected');
  });

  // 4. Test Deactivation & Lookup Filtering
  TestHarness.test('Master Data: Deactivation excludes from lookup', function () {
    const uniqueName = 'DEACTIVATE VENDOR ' + Utilities.getUuid().slice(0, 6).toUpperCase();
    const vendor = MasterDataModule.create('vendors', {
      name: uniqueName,
      contactPerson: 'Vendor Rep',
      phone: '9840199999',
    }, token);

    // Should appear in lookup
    let lookupResults = MasterDataModule.lookup('vendors', { search: uniqueName }, token);
    TestHarness.assert(lookupResults.some(function(v) { return v.id === vendor.id; }), 'Active vendor should appear in lookup');

    // Deactivate
    const deactRes = MasterDataModule.deactivate('vendors', vendor.id, token);
    TestHarness.assertEqual(deactRes.success, true, 'Deactivation should succeed');

    // Lookup should now exclude it
    lookupResults = MasterDataModule.lookup('vendors', { search: uniqueName }, token);
    TestHarness.assert(!lookupResults.some(function(v) { return v.id === vendor.id; }), 'Deactivated vendor must be excluded from lookup');

    // Reactivate
    const reactRes = MasterDataModule.reactivate('vendors', vendor.id, token);
    TestHarness.assertEqual(reactRes.success, true, 'Reactivation should succeed');

    // Lookup should include it again
    lookupResults = MasterDataModule.lookup('vendors', { search: uniqueName }, token);
    TestHarness.assert(lookupResults.some(function(v) { return v.id === vendor.id; }), 'Reactivated vendor should appear in lookup again');
  });
}
