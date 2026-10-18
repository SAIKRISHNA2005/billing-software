import { describe, it, expect } from 'vitest';
import { computeVehicleAlerts, COMPLIANCE_VALIDITY_FIELDS } from './vehicleAlertsHelper';

describe('vehicleAlertsHelper', () => {
  it('has all 6 compliance validity fields', () => {
    expect(COMPLIANCE_VALIDITY_FIELDS.length).toBe(6);
    const keys = COMPLIANCE_VALIDITY_FIELDS.map((f) => f.key);
    expect(keys).toContain('fitnessValidUpTo');
    expect(keys).toContain('taxValidUpTo');
    expect(keys).toContain('insuranceValidUpTo');
    expect(keys).toContain('puccValidUpTo');
    expect(keys).toContain('permitValidUpTo');
    expect(keys).toContain('nationalPermitValidUpTo');
  });

  it('correctly categorizes expired, critical, and warning vehicle alerts', () => {
    const today = new Date();
    const formatDate = (daysOffset: number) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysOffset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const sampleVehicles = [
      {
        id: 'VEH-01',
        vehicleNumber: 'TN01AA1111',
        ownerName: 'Driver 1',
        fitnessValidUpTo: formatDate(-5), // Expired 5 days ago
        insuranceValidUpTo: formatDate(2), // Critical: 2 days left
        puccValidUpTo: formatDate(15), // Warning: 15 days left
        taxValidUpTo: formatDate(60), // Not in alert threshold (> 30 days)
      },
      {
        id: 'VEH-02',
        vehicleNumber: 'TN02BB2222',
        ownerName: 'Driver 2',
        permitValidUpTo: formatDate(1), // Critical: 1 day left
      },
    ];

    const alerts = computeVehicleAlerts(sampleVehicles, 30);

    // 4 alerts in total (3 from VEH-01, 1 from VEH-02)
    expect(alerts.length).toBe(4);

    const expired = alerts.find((a) => a.documentKey === 'fitnessValidUpTo');
    expect(expired).toBeDefined();
    expect(expired?.isExpired).toBe(true);
    expect(expired?.status).toBe('expired');
    expect(expired?.vehicleNumber).toBe('TN01AA1111');

    const critical = alerts.find((a) => a.documentKey === 'insuranceValidUpTo');
    expect(critical).toBeDefined();
    expect(critical?.isExpired).toBe(false);
    expect(critical?.status).toBe('critical');

    const warning = alerts.find((a) => a.documentKey === 'puccValidUpTo');
    expect(warning).toBeDefined();
    expect(warning?.isExpired).toBe(false);
    expect(warning?.status).toBe('warning');

    // Tax valid up to 60 days should NOT be in alerts
    const taxAlert = alerts.find((a) => a.documentKey === 'taxValidUpTo');
    expect(taxAlert).toBeUndefined();
  });

  it('handles empty or missing vehicle arrays safely', () => {
    expect(computeVehicleAlerts([])).toEqual([]);
    expect(computeVehicleAlerts(null as any)).toEqual([]);
    expect(computeVehicleAlerts([{ id: 'VEH-EMPTY' }])).toEqual([]);
  });
});
