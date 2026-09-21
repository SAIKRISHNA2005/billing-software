/**
 * Operations Helper Functions & Stage Classification (Phase 8)
 */

export const MOVEMENT_STAGES = ['VEHICLE_ASSIGNED', 'CONTAINER_MOVEMENT', 'PORT_MOVEMENT'] as const;
export const PENDING_STAGES = ['ENQUIRY_CREATED', 'VEHICLE_ASSIGNED', 'CONTAINER_MOVEMENT', 'PORT_MOVEMENT'] as const;
export const COMPLETED_STAGES = ['COMPLETED', 'BILLING', 'PROCESSED'] as const;

export type MovementStage = (typeof MOVEMENT_STAGES)[number];
export type PendingStage = (typeof PENDING_STAGES)[number];
export type CompletedStage = (typeof COMPLETED_STAGES)[number];

export function isMovementStage(stage?: string | null): boolean {
  if (!stage) return false;
  return (MOVEMENT_STAGES as readonly string[]).includes(stage);
}

export function isPendingStage(stage?: string | null): boolean {
  if (!stage) return false;
  return (PENDING_STAGES as readonly string[]).includes(stage);
}

export function isCompletedStage(stage?: string | null): boolean {
  if (!stage) return false;
  return (COMPLETED_STAGES as readonly string[]).includes(stage);
}

export interface GateTimesValidationResult {
  valid: boolean;
  error?: string;
  autoMovementStatus?: 'NOT_MOVED' | 'MOVED';
  autoShippingStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

/**
 * Validates chronological gate times (D13: out >= in).
 */
export function validateGateTimes(times: {
  companyInTime?: string | null;
  companyOutTime?: string | null;
  printInTime?: string | null;
  printOutTime?: string | null;
  portInTime?: string | null;
  portOutTime?: string | null;
}): GateTimesValidationResult {
  const parseMs = (val?: string | null) => {
    if (!val) return null;
    const str = String(val).trim();
    const match = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const y = parseInt(match[3], 10);
      let hh = match[4] ? parseInt(match[4], 10) : 0;
      const mm = match[5] ? parseInt(match[5], 10) : 0;
      const ss = match[6] ? parseInt(match[6], 10) : 0;
      const ampm = match[7] ? match[7].toUpperCase() : null;

      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;

      return new Date(y, m, d, hh, mm, ss).getTime();
    }
    const parsed = Date.parse(str);
    return isNaN(parsed) ? null : parsed;
  };

  const compIn = parseMs(times.companyInTime);
  const compOut = parseMs(times.companyOutTime);
  if (compIn && compOut && compOut < compIn) {
    return {
      valid: false,
      error: 'Factory Gate-Out time cannot be earlier than Factory Gate-In time.',
    };
  }

  const printIn = parseMs(times.printInTime);
  const printOut = parseMs(times.printOutTime);
  if (printIn && printOut && printOut < printIn) {
    return {
      valid: false,
      error: 'Print Gate-Out time cannot be earlier than Print Gate-In time.',
    };
  }

  const portIn = parseMs(times.portInTime);
  const portOut = parseMs(times.portOutTime);
  if (portIn && portOut && portOut < portIn) {
    return {
      valid: false,
      error: 'Port Gate-Out time cannot be earlier than Port Gate-In time.',
    };
  }

  let autoMovementStatus: 'NOT_MOVED' | 'MOVED' = 'NOT_MOVED';
  let autoShippingStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' = 'PENDING';

  if (times.portOutTime) {
    autoMovementStatus = 'MOVED';
    autoShippingStatus = 'COMPLETED';
  } else if (times.companyOutTime || times.printInTime || times.portInTime) {
    autoMovementStatus = 'MOVED';
    autoShippingStatus = 'IN_PROGRESS';
  }

  return {
    valid: true,
    autoMovementStatus,
    autoShippingStatus,
  };
}
