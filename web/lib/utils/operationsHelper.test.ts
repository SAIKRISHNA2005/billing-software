import { describe, it, expect } from 'vitest';
import {
  isMovementStage,
  isPendingStage,
  isCompletedStage,
  validateGateTimes,
} from './operationsHelper';

describe('Operations Helper: Stage Classification', () => {
  it('identifies movement stages (VEHICLE_ASSIGNED to PORT_MOVEMENT)', () => {
    expect(isMovementStage('VEHICLE_ASSIGNED')).toBe(true);
    expect(isMovementStage('CONTAINER_MOVEMENT')).toBe(true);
    expect(isMovementStage('PORT_MOVEMENT')).toBe(true);
    expect(isMovementStage('ENQUIRY_CREATED')).toBe(false);
    expect(isMovementStage('COMPLETED')).toBe(false);
    expect(isMovementStage('BILLING')).toBe(false);
  });

  it('identifies pending stages (all stages before COMPLETED)', () => {
    expect(isPendingStage('ENQUIRY_CREATED')).toBe(true);
    expect(isPendingStage('VEHICLE_ASSIGNED')).toBe(true);
    expect(isPendingStage('CONTAINER_MOVEMENT')).toBe(true);
    expect(isPendingStage('PORT_MOVEMENT')).toBe(true);
    expect(isPendingStage('COMPLETED')).toBe(false);
    expect(isPendingStage('BILLING')).toBe(false);
    expect(isPendingStage('PROCESSED')).toBe(false);
  });

  it('identifies completed stages (COMPLETED or later)', () => {
    expect(isCompletedStage('COMPLETED')).toBe(true);
    expect(isCompletedStage('BILLING')).toBe(true);
    expect(isCompletedStage('PROCESSED')).toBe(true);
    expect(isCompletedStage('PORT_MOVEMENT')).toBe(false);
  });
});

describe('Operations Helper: Gate Times Validation & Auto Statuses (D13)', () => {
  it('validates proper chronological gate order', () => {
    const valid = {
      companyInTime: '21-09-2026 10:00 AM',
      companyOutTime: '21-09-2026 01:00 PM',
      printInTime: '21-09-2026 02:00 PM',
      printOutTime: '21-09-2026 03:00 PM',
      portInTime: '21-09-2026 04:00 PM',
      portOutTime: '21-09-2026 06:00 PM',
    };

    const res = validateGateTimes(valid);
    expect(res.valid).toBe(true);
    expect(res.autoMovementStatus).toBe('MOVED');
    expect(res.autoShippingStatus).toBe('COMPLETED');
  });

  it('rejects outTime earlier than inTime for factory', () => {
    const invalid = {
      companyInTime: '21-09-2026 04:00 PM',
      companyOutTime: '21-09-2026 02:00 PM', // earlier!
    };

    const res = validateGateTimes(invalid);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Factory Gate-Out');
  });

  it('rejects outTime earlier than inTime for port', () => {
    const invalid = {
      portInTime: '21-09-2026 05:00 PM',
      portOutTime: '21-09-2026 03:00 PM', // earlier!
    };

    const res = validateGateTimes(invalid);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Port Gate-Out');
  });

  it('assigns IN_PROGRESS when factory gate-out or port in recorded but port out is not', () => {
    const inProgress = {
      companyInTime: '21-09-2026 10:00 AM',
      companyOutTime: '21-09-2026 11:30 AM',
    };

    const res = validateGateTimes(inProgress);
    expect(res.valid).toBe(true);
    expect(res.autoMovementStatus).toBe('MOVED');
    expect(res.autoShippingStatus).toBe('IN_PROGRESS');
  });

  it('leaves NOT_MOVED and PENDING when no gate-out or port times are recorded', () => {
    const initial = {
      companyInTime: '21-09-2026 09:00 AM',
    };

    const res = validateGateTimes(initial);
    expect(res.valid).toBe(true);
    expect(res.autoMovementStatus).toBe('NOT_MOVED');
    expect(res.autoShippingStatus).toBe('PENDING');
  });
});
