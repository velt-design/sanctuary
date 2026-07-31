import { describe, expect, it } from 'vitest';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import {
  buildGanttAttentionReasons,
  buildScheduleGanttModel,
  canEditGanttCommitment,
  GANTT_DEFAULT_ZOOM_WEEKS,
  GANTT_TIMELINE_DAYS,
  GANTT_ZOOM_WEEK_OPTIONS,
  ganttBaseDayPxForZoomWeeks,
  normalizeGanttZoomWeeks,
} from './ScheduleGanttModel';

const installer: Installer = {
  id: 'crew-alpha',
  name: 'Crew Alpha',
  color: '#0f766e',
  active: true,
  sortOrder: 0,
};

function scheduleItem(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    projectId: `project-${id}`,
    estimateId: `estimate-${id}`,
    installerId: installer.id,
    sortIndex: 0,
    itemType: 'job',
    forecastStart: '2026-04-07',
    forecastEndExclusive: '2026-04-09',
    forecastDurationDays: 2,
    durationHoursOverride: 16,
    mode: 'pinned',
    jobStatus: 'not_started',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildModel(
  items: ScheduleItem[],
  issues: SchedulingIssue[] = [],
  options: {
    today?: string;
    holidays?: Array<{ date: string; name?: string; kind: 'holiday' }>;
  } = {},
) {
  const attentionReasonsByScheduleId = buildGanttAttentionReasons(items, issues);
  return buildScheduleGanttModel({
    today: options.today ?? '2026-04-07',
    scheduleMode: 'v2',
    installers: [installer],
    laneItems: new Map([[installer.id, items]]),
    visibleScheduleItems: items,
    projectsById: new Map(),
    estimatesById: new Map(),
    scheduleBars: items.map((item, index) => ({
      scheduleItemId: item.id,
      installerId: installer.id,
      projectId: item.projectId,
      estimateId: item.estimateId,
      projectName: `Project ${index + 1}`,
      status: 'DEPOSIT',
      startDate: item.forecastStart ?? '2026-04-07',
      endDate: '2026-04-08',
      durationHours: item.durationHoursOverride ?? 16,
    })),
    scheduleIssues: issues,
    holidays: options.holidays ?? [],
    collapsedCrews: {},
    showPlanned: true,
    zoomWeeks: GANTT_DEFAULT_ZOOM_WEEKS,
    ganttDrag: null,
    ganttDragDelta: 0,
    scheduleItemById: new Map(items.map((item) => [item.id, item])),
    attentionReasonsByScheduleId,
  });
}

describe('ScheduleGanttModel', () => {
  it('defaults visual zoom to eight weeks while retaining the 84-day planning model', () => {
    const model = buildModel([]);

    expect(GANTT_DEFAULT_ZOOM_WEEKS).toBe(8);
    expect(GANTT_ZOOM_WEEK_OPTIONS).toEqual([4, 8, 12]);
    expect(normalizeGanttZoomWeeks(999)).toBe(8);
    expect(ganttBaseDayPxForZoomWeeks(4)).toBeGreaterThan(ganttBaseDayPxForZoomWeeks(8));
    expect(ganttBaseDayPxForZoomWeeks(8)).toBeGreaterThan(ganttBaseDayPxForZoomWeeks(12));
    expect(GANTT_TIMELINE_DAYS).toBe(84);
    expect(model.rangeDays).toBe(84);
    expect(model.axis.days).toHaveLength(84);
    expect(model.rangeStart).toBe('2026-04-06');
    expect(model.rangeEnd).toBe('2026-06-28');
  });

  it('derives attention only from attached issues, required client updates, and drift beyond flex', () => {
    const issueOnly = scheduleItem('issue-only');
    const clientUpdate = scheduleItem('client-update', { clientUpdateStatus: 'needed' });
    const driftBeyondFlex = scheduleItem('drift-beyond-flex', {
      plannedCommitmentType: 'fixed_date',
      plannedStart: '2026-04-07',
      plannedFlexDays: 1,
      driftDays: 2,
    });
    const combined = scheduleItem('combined', {
      clientUpdateStatus: 'needed',
      plannedCommitmentType: 'week_of',
      plannedWeekStart: '2026-04-06',
      plannedFlexDays: 2,
      driftDays: 5,
    });
    const withinFlex = scheduleItem('within-flex', {
      plannedCommitmentType: 'fixed_date',
      plannedStart: '2026-04-07',
      plannedFlexDays: 3,
      driftDays: 3,
    });
    const acknowledged = scheduleItem('acknowledged', { clientUpdateStatus: 'acknowledged' });
    const uncommittedDrift = scheduleItem('uncommitted-drift', { driftDays: 20 });
    const issues: SchedulingIssue[] = [
      { scheduleItemId: issueOnly.id, level: 'warning', message: 'Missing duration' },
      { scheduleItemId: combined.id, level: 'warning', message: 'First issue' },
      { scheduleItemId: combined.id, level: 'error', message: 'Pinned conflict' },
      { projectId: 'project-without-item', level: 'error', message: 'Not attached to an item' },
    ];

    const reasons = buildGanttAttentionReasons(
      [issueOnly, clientUpdate, driftBeyondFlex, combined, withinFlex, acknowledged, uncommittedDrift],
      issues,
    );

    expect(reasons.get(issueOnly.id)).toEqual(['schedule_issue']);
    expect(reasons.get(clientUpdate.id)).toEqual(['client_update']);
    expect(reasons.get(driftBeyondFlex.id)).toEqual(['drift']);
    expect(reasons.get(combined.id)).toEqual(['schedule_issue', 'client_update', 'drift']);
    expect(reasons.has(withinFlex.id)).toBe(false);
    expect(reasons.has(acknowledged.id)).toBe(false);
    expect(reasons.has(uncommittedDrift.id)).toBe(false);
    expect(reasons.size).toBe(4);
  });

  it('deduplicates crew attention counts and keeps timing locks in the row model', () => {
    const combined = scheduleItem('combined', {
      clientUpdateStatus: 'needed',
      plannedCommitmentType: 'fixed_date',
      plannedStart: '2026-04-07',
      plannedFlexDays: 1,
      driftDays: 4,
    });
    const locked = scheduleItem('locked', { jobStatus: 'in_progress' });
    const issues: SchedulingIssue[] = [
      { scheduleItemId: combined.id, level: 'warning', message: 'First issue' },
      { scheduleItemId: combined.id, level: 'error', message: 'Pinned conflict' },
    ];

    const model = buildModel([combined, locked], issues);
    const group = model.rows.find((row) => row.kind === 'group');
    const combinedRow = model.rows.find(
      (row) => row.kind === 'item' && row.scheduleItemId === combined.id,
    );
    const lockedRow = model.rows.find(
      (row) => row.kind === 'item' && row.scheduleItemId === locked.id,
    );

    expect(group).toMatchObject({ itemCount: 2, loadLabel: '2 jobs · 4d forecast', attentionCount: 1 });
    expect(combinedRow).toMatchObject({
      needsAttention: true,
      attentionReasons: ['schedule_issue', 'client_update', 'drift'],
      attentionBadgeLabel: '3 issues',
      attentionLabel: 'Schedule conflict; Client update needed; Forecast drift exceeds flex by 3 working days',
      timingAdjustable: true,
      issueLevel: 'error',
      conflictMessage: 'Pinned conflict',
    });
    expect(lockedRow).toMatchObject({
      needsAttention: false,
      attentionReasons: [],
      timingAdjustable: false,
    });
  });

  it('allows commitment edits only for unfinished V2 jobs', () => {
    expect(canEditGanttCommitment('v2', scheduleItem('draft'))).toBe(true);
    expect(canEditGanttCommitment('v2', scheduleItem('in-progress', { jobStatus: 'in_progress' }))).toBe(true);
    expect(canEditGanttCommitment('v2', scheduleItem('paused', { jobStatus: 'paused' }))).toBe(true);
    expect(canEditGanttCommitment('v2', scheduleItem('done', { jobStatus: 'done' }))).toBe(false);
    expect(
      canEditGanttCommitment('v2', scheduleItem('completed', { scheduleStatus: 'COMPLETED' })),
    ).toBe(false);
    expect(
      canEditGanttCommitment('v2', scheduleItem('actually-ended', { actualEndDate: '2026-04-08' })),
    ).toBe(false);
    expect(
      canEditGanttCommitment('v2', scheduleItem('downtime', { itemType: 'downtime' })),
    ).toBe(false);
    expect(canEditGanttCommitment('legacy', scheduleItem('legacy'))).toBe(false);
    expect(canEditGanttCommitment('v2', null)).toBe(false);
  });

  it('keeps a weekend today marker on the actual calendar date', () => {
    const model = buildModel([], [], { today: '2026-04-11' });
    const saturday = model.axis.days.find((day) => day.date === '2026-04-11');

    expect(saturday?.isWeekend).toBe(true);
    expect(model.displayToday).toBe('2026-04-11');
    expect(model.todayColumnLeftPx).toBe(saturday?.startPx);
    expect(model.todayColumnWidthPx).toBe(saturday?.widthPx);
    expect(model.todayLinePx).toBe(saturday?.startPx);
  });
});
