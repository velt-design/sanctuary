import { describe, expect, it } from 'vitest';
import { addWorkHours, diffDaysYmd, isWorkday } from './date';
import { deriveDurationHoursFromEstimate, roundUpToHalfDayHours } from './duration';
import { buildScheduleBars } from './engine';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';

function makeEstimate(partial?: Partial<Estimate>): Estimate {
  const base: Estimate = {
    id: 'est_1',
    projectId: 'proj_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'approved',
    inputs: {} as any,
    derived: {} as any,
    outputs: {
      materials: { lines: [], totals: {} as any } as any,
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: {} as any,
      totals: { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: [],
    },
    configVersions: { pricebook: 'x', installActions: 'x', overheads: 'x', rules: 'x', manifest: 'x' },
  };
  return { ...base, ...partial, outputs: { ...base.outputs, ...(partial?.outputs as any) } } as Estimate;
}

describe('scheduling.duration', () => {
  it('rounds up to nearest 0.5 day (4.5h)', () => {
    expect(roundUpToHalfDayHours(0)).toBe(0);
    expect(roundUpToHalfDayHours(0.1)).toBe(4.5);
    expect(roundUpToHalfDayHours(4.5)).toBe(4.5);
    expect(roundUpToHalfDayHours(4.6)).toBe(9);
    expect(roundUpToHalfDayHours(9)).toBe(9);
    expect(roundUpToHalfDayHours(10)).toBe(13.5);
  });

  it('derives duration from crew minutes', () => {
    const est = makeEstimate({ outputs: { install: { actions: [], totals: { crew_minutes: 600, crew_hours: 10, install_ex_gst: 0 } } as any } });
    const res = deriveDurationHoursFromEstimate(est);
    expect(res.durationHours).toBe(13.5);
    expect(res.crewHours).toBeCloseTo(10, 2);
  });

  it('falls back to 1 day when estimate has no minutes/payout', () => {
    const est = makeEstimate();
    const res = deriveDurationHoursFromEstimate(est);
    expect(res.durationHours).toBe(9);
    expect(res.issues.length).toBeGreaterThan(0);
  });
});

describe('scheduling.date', () => {
  it('detects workdays', () => {
    expect(isWorkday('2026-01-09')).toBe(true); // Fri
    expect(isWorkday('2026-01-10')).toBe(false); // Sat
    expect(isWorkday('2026-01-11')).toBe(false); // Sun
    expect(isWorkday('2026-01-12')).toBe(true); // Mon
  });

  it('adds work hours across weekends', () => {
    const res = addWorkHours('2026-01-09', 0, 13.5); // Fri + 1.5 days
    expect(res.endDateInclusive).toBe('2026-01-12'); // Mon
    expect(res.endCursor.date).toBe('2026-01-12');
    expect(res.endCursor.hour).toBe(4.5);
  });

  it('diffDaysYmd works for simple ranges', () => {
    expect(diffDaysYmd('2026-01-01', '2026-01-02')).toBe(1);
    expect(diffDaysYmd('2026-01-02', '2026-01-01')).toBe(-1);
  });
});

describe('scheduling.engine', () => {
  it('builds sequential bars per lane', () => {
    const installers: Installer[] = [{ id: 'ins_1', name: 'Crew 1', color: '#000', active: true, sortOrder: 1, availableFrom: '2026-01-05' }];
    const projectsById = new Map<string, Project>([['proj_1', { id: 'proj_1', createdAt: '2026-01-01T00:00:00Z', projectName: 'Job A', status: 'SCHEDULED' }]]);
    const est1 = makeEstimate({ id: 'est_1', projectId: 'proj_1', outputs: { install: { actions: [], totals: { crew_minutes: 540, crew_hours: 9, install_ex_gst: 0 } } as any } });
    const est2 = makeEstimate({ id: 'est_2', projectId: 'proj_1', outputs: { install: { actions: [], totals: { crew_minutes: 270, crew_hours: 4.5, install_ex_gst: 0 } } as any } });
    const estimatesById = new Map<string, Estimate>([
      ['est_1', est1],
      ['est_2', est2],
    ]);
    const items: ScheduleItem[] = [
      { id: 'sch_1', projectId: 'proj_1', estimateId: 'est_1', installerId: 'ins_1', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'sch_2', projectId: 'proj_1', estimateId: 'est_2', installerId: 'ins_1', sortIndex: 1, updatedAt: '2026-01-01T00:00:00Z' },
    ];

    const res = buildScheduleBars({ today: '2026-01-05', installers, scheduleItems: items, projectsById, estimatesById });
    expect(res.bars).toHaveLength(2);
    expect(res.bars[0].startDate).toBe('2026-01-05');
    expect(res.bars[0].endDate).toBe('2026-01-05');
    expect(res.bars[1].startDate).toBe('2026-01-06'); // next day start after full day
  });

  it('ignores start override that is before lane availability', () => {
    const installers: Installer[] = [{ id: 'ins_1', name: 'Crew 1', color: '#000', active: true, sortOrder: 1, availableFrom: '2026-01-06' }];
    const projectsById = new Map<string, Project>([['proj_1', { id: 'proj_1', createdAt: '2026-01-01T00:00:00Z', projectName: 'Job A', status: 'SCHEDULED' }]]);
    const est = makeEstimate({ outputs: { install: { actions: [], totals: { crew_minutes: 540, crew_hours: 9, install_ex_gst: 0 } } as any } });
    const estimatesById = new Map<string, Estimate>([['est_1', est]]);
    const items: ScheduleItem[] = [
      {
        id: 'sch_1',
        projectId: 'proj_1',
        estimateId: 'est_1',
        installerId: 'ins_1',
        sortIndex: 0,
        // Future start override that conflicts with lane availability (should be ignored for tentative jobs).
        startDateOverride: '2026-01-05',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const res = buildScheduleBars({ today: '2026-01-01', installers, scheduleItems: items, projectsById, estimatesById });
    expect(res.bars[0].startDate).toBe('2026-01-06');
    expect(res.issues.some((i) => i.message.includes('ignored'))).toBe(true);
  });

  it('does not push a job forward once its start date is in the past (assume started)', () => {
    const installers: Installer[] = [{ id: 'ins_1', name: 'Crew 1', color: '#000', active: true, sortOrder: 1, availableFrom: '2026-01-06' }];
    const projectsById = new Map<string, Project>([['proj_1', { id: 'proj_1', createdAt: '2026-01-01T00:00:00Z', projectName: 'Job A', status: 'SCHEDULED' }]]);
    const est = makeEstimate({ outputs: { install: { actions: [], totals: { crew_minutes: 540, crew_hours: 9, install_ex_gst: 0 } } as any } });
    const estimatesById = new Map<string, Estimate>([['est_1', est]]);
    const items: ScheduleItem[] = [
      {
        id: 'sch_1',
        projectId: 'proj_1',
        estimateId: 'est_1',
        installerId: 'ins_1',
        sortIndex: 0,
        startDateOverride: '2026-01-01',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const res = buildScheduleBars({ today: '2026-01-05', installers, scheduleItems: items, projectsById, estimatesById });
    expect(res.bars[0].startDate).toBe('2026-01-01');
    expect(res.issues.some((i) => i.message.includes('ignored'))).toBe(false);
  });

  it('keeps confirmed jobs fixed and surfaces overlap as a conflict warning', () => {
    const installers: Installer[] = [{ id: 'ins_1', name: 'Crew 1', color: '#000', active: true, sortOrder: 1, availableFrom: '2026-01-10' }];
    const projectsById = new Map<string, Project>([['proj_1', { id: 'proj_1', createdAt: '2026-01-01T00:00:00Z', projectName: 'Job A', status: 'SCHEDULED' }]]);
    const est = makeEstimate({ outputs: { install: { actions: [], totals: { crew_minutes: 540, crew_hours: 9, install_ex_gst: 0 } } as any } });
    const estimatesById = new Map<string, Estimate>([['est_1', est]]);
    const items: ScheduleItem[] = [
      {
        id: 'sch_1',
        projectId: 'proj_1',
        estimateId: 'est_1',
        installerId: 'ins_1',
        sortIndex: 0,
        scheduleStatus: 'CONFIRMED',
        startDateOverride: '2026-01-06',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const res = buildScheduleBars({ today: '2026-01-01', installers, scheduleItems: items, projectsById, estimatesById });
    expect(res.bars[0].startDate).toBe('2026-01-06');
    expect(res.issues.some((i) => i.message.toLowerCase().includes('confirmed start'))).toBe(true);
  });
});
