/**
 * Global Vehicle Work Status Synchronization System
 * Synchronizes "Sent for Work" status across:
 * - Vehicle Management (/operations/movement)
 * - Vehicle Master (/settings/master)
 * - Daily Report (/reports/daily)
 * - Enquiries (/enquiries)
 * - Operations Pending (/operations/pending)
 * 
 * Supports:
 * - Local storage persistence for instant UI consistency
 * - Real-time window CustomEvent broadcasting
 * - Cross-tab real-time sync via window storage listener
 * - Asynchronous background persistence to backend API
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STORAGE_KEY = 'tms_vehicle_status_overrides';
const SYNC_EVENT_NAME = 'tms:vehicle-status-updated';

export interface VehicleStatusEventDetail {
  vehicleNumber: string;
  sentForWork: boolean;
  sourceId?: string;
  timestamp: number;
}

// Normalize vehicle registration number for uniform key matching (e.g. "TN-04-AB-1234" -> "TN04AB1234")
export function normalizeVehicleNumber(vehicleNumber?: string | null): string {
  if (!vehicleNumber) return '';
  return String(vehicleNumber).trim().toUpperCase().replace(/[\s\-_]/g, '');
}

/**
 * Reads all vehicle overrides stored in localStorage
 */
export function getAllVehicleOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Computes whether a vehicle is "Sent for work":
 * - If user explicitly toggled it, returns the toggled boolean
 * - Else if vehicle details mentioned (non-empty vehicle number), defaults to ON (true)
 * - Else (no vehicle details mentioned), defaults to OFF (false)
 */
export function computeVehicleStatus(
  vehicleNumber?: string | null,
  initialFallback?: boolean
): boolean {
  const norm = normalizeVehicleNumber(vehicleNumber);
  const overrides = getAllVehicleOverrides();

  if (norm && overrides[norm] !== undefined) {
    return overrides[norm];
  }

  if (initialFallback !== undefined) {
    return initialFallback;
  }

  // Default: ON if vehicle details mentioned, OFF if not mentioned
  return Boolean(norm && norm !== '-' && norm.length >= 3);
}

/**
 * Updates vehicle status, dispatches event, and synchronizes with backend
 */
export async function setVehicleWorkStatus(
  vehicleNumber: string | null | undefined,
  sentForWork: boolean,
  options?: { enquiryId?: string; vehicleId?: string; silent?: boolean }
): Promise<boolean> {
  const norm = normalizeVehicleNumber(vehicleNumber);
  if (!norm) return false;

  // 1. Update localStorage
  if (typeof window !== 'undefined') {
    try {
      const current = getAllVehicleOverrides();
      current[norm] = sentForWork;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Storage quota or disabled
    }

    // 2. Dispatch CustomEvent for immediate same-page reactivity
    const detail: VehicleStatusEventDetail = {
      vehicleNumber: norm,
      sentForWork,
      sourceId: options?.enquiryId || options?.vehicleId,
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail }));
  }

  // 3. Persist to Backend API in background
  try {
    await axios.post('/api/vehicles/status', {
      vehicleNumber: norm,
      sentForWork,
      enquiryId: options?.enquiryId,
      vehicleId: options?.vehicleId,
    });
    return true;
  } catch {
    // If backend offline, local state remains consistent
    return false;
  }
}

/**
 * React Hook for listening to and toggling vehicle status with zero latency
 */
export function useVehicleWorkStatus(
  vehicleNumber?: string | null,
  initialFallback?: boolean,
  options?: { enquiryId?: string; vehicleId?: string }
) {
  const norm = normalizeVehicleNumber(vehicleNumber);
  const [status, setStatus] = useState<boolean>(() =>
    computeVehicleStatus(vehicleNumber, initialFallback)
  );

  useEffect(() => {
    setStatus(computeVehicleStatus(vehicleNumber, initialFallback));
  }, [vehicleNumber, initialFallback]);

  useEffect(() => {
    if (!norm) return;

    // Same-window updates
    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<VehicleStatusEventDetail>;
      if (custom.detail && custom.detail.vehicleNumber === norm) {
        setStatus(custom.detail.sentForWork);
      }
    };

    // Cross-tab updates
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed[norm] !== undefined) {
            setStatus(parsed[norm]);
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener(SYNC_EVENT_NAME, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(SYNC_EVENT_NAME, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [norm]);

  const toggle = useCallback(
    async (nextState?: boolean) => {
      const targetState = nextState !== undefined ? nextState : !status;
      setStatus(targetState);
      return await setVehicleWorkStatus(norm, targetState, options);
    },
    [norm, status, options]
  );

  return {
    status,
    toggle,
    hasVehicle: Boolean(norm && norm !== '-' && norm.length >= 3),
  };
}
