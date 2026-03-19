import { describe, expect, it } from 'vitest';
import { SCHEDULING_READY_PROJECT_STATUS, isSchedulingReadyProjectStatus, normalizeSchedulingProjectStatus } from './readiness';

describe('scheduling.readiness', () => {
  it('normalizes the deposit stage for scheduling readiness checks', () => {
    expect(normalizeSchedulingProjectStatus('deposit')).toBe(SCHEDULING_READY_PROJECT_STATUS);
    expect(isSchedulingReadyProjectStatus('deposit')).toBe(true);
  });

  it('rejects earlier pipeline stages from the scheduling queue', () => {
    expect(isSchedulingReadyProjectStatus('QUOTING')).toBe(false);
    expect(isSchedulingReadyProjectStatus('SENT')).toBe(false);
    expect(isSchedulingReadyProjectStatus('CONTACTED')).toBe(false);
  });
});
