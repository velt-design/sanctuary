import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '@/lib/types/scheduling';
import {
  buildScheduleAttentionPresentation,
  buildSchedulePlanPresentation,
  formatScheduleCrewLoad,
  scheduleForecastDays,
} from './ScheduleOperationalPresentation';

function item(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'schedule-1',
    projectId: 'project-1',
    estimateId: 'estimate-1',
    installerId: 'crew-1',
    itemType: 'job',
    scheduleStatus: 'TENTATIVE',
    sortIndex: 0,
    updatedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  };
}

describe('ScheduleOperationalPresentation', () => {
  it('distinguishes draft and committed plan truth', () => {
    expect(buildSchedulePlanPresentation(item(), (value) => value)).toEqual({ committed: false, label: 'Draft plan' });
    expect(buildSchedulePlanPresentation(item({ plannedCommitmentType: 'fixed_date', plannedStart: '2026-08-04' }), (value) => value))
      .toEqual({ committed: true, label: 'Starts 2026-08-04' });
  });

  it('names every factual attention reason without relying on colour', () => {
    const presentation = buildScheduleAttentionPresentation({
      item: item({ plannedCommitmentType: 'fixed_date', plannedStart: '2026-08-01', plannedFlexDays: 1, driftDays: 4, clientUpdateStatus: 'needed' }),
      issueLevel: 'error',
    });
    expect(presentation.badgeLabel).toBe('3 issues');
    expect(presentation.signals.map((signal) => signal.label)).toEqual(['Conflict', 'Client update', 'Drift +4d']);
    expect(presentation.detailLabel).toContain('Schedule conflict');
  });

  it('summarises comparable crew workload from server forecast durations', () => {
    const items = [item({ forecastDurationDays: 2 }), item({ id: 'schedule-2', durationHoursOverride: 27 })];
    expect(scheduleForecastDays(items)).toBe(5);
    expect(formatScheduleCrewLoad(items.length, 5)).toBe('2 jobs · 5d forecast');
    expect(formatScheduleCrewLoad(0, 0)).toBe('0 jobs');
  });
});
