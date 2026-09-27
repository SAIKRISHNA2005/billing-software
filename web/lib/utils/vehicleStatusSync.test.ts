import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeVehicleNumber,
  computeVehicleStatus,
  getAllVehicleOverrides,
} from './vehicleStatusSync';

describe('Vehicle Work Status Synchronization System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes vehicle numbers uniformly', () => {
    expect(normalizeVehicleNumber('TN-04-AB-1234')).toBe('TN04AB1234');
    expect(normalizeVehicleNumber(' tn 02 cd 5678 ')).toBe('TN02CD5678');
    expect(normalizeVehicleNumber('')).toBe('');
    expect(normalizeVehicleNumber(null)).toBe('');
  });

  it('defaults to ON (true) when vehicle details are mentioned', () => {
    expect(computeVehicleStatus('TN04AB1234')).toBe(true);
    expect(computeVehicleStatus('KA01EF9999')).toBe(true);
  });

  it('defaults to OFF (false) when vehicle details are not mentioned', () => {
    expect(computeVehicleStatus('')).toBe(false);
    expect(computeVehicleStatus(null)).toBe(false);
    expect(computeVehicleStatus('-')).toBe(false);
  });

  it('respects explicit user overrides stored in state', () => {
    localStorage.setItem(
      'tms_vehicle_status_overrides',
      JSON.stringify({ TN04AB1234: false, UNASSIGNED: true })
    );

    // Default would be true, but user override is false
    expect(computeVehicleStatus('TN04AB1234')).toBe(false);

    // Another vehicle with no override still defaults according to details mentioned rule
    expect(computeVehicleStatus('TN02CD5678')).toBe(true);
  });
});
