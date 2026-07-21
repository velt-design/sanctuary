import { describe, expect, it } from 'vitest';
import {
  buildProjectOwnerSummary,
  portalDueDateToIso,
  projectOwnerRequired,
  resolveProjectPrimaryAction,
  type ProjectCommandActionCandidate,
} from './actionResolver';
import type { ProjectCommandStaffSummary } from './types';

const STAFF = new Map<string, ProjectCommandStaffSummary>([
  ['sales-1', { userId: 'sales-1', displayName: 'Sam Sales', email: 'sam@example.test', accessRole: 'staff' as const }],
  ['design-1', { userId: 'design-1', displayName: 'Dana Design', email: 'dana@example.test', accessRole: 'staff' as const }],
]);

function candidate(overrides: Partial<ProjectCommandActionCandidate> = {}): ProjectCommandActionCandidate {
  return {
    sourceKind: 'automation_task',
    sourceId: 'task-1',
    title: 'Review new lead',
    category: 'Other',
    sourceType: 'REVIEW_NEW_LEAD',
    assignedTo: null,
    dueAt: '2026-07-20T05:00:00.000Z',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    isCritical: false,
    criticalReason: null,
    rescheduleCount: 0,
    ...overrides,
  };
}

function owner(stage = 'site_visit') {
  return buildProjectOwnerSummary({
    stage,
    assignment: { ownerKey: 'jordan', updatedAt: '2026-07-01T00:00:00.000Z' },
    isAdmin: false,
  });
}

describe('project command action resolution', () => {
  it('requires one project owner from lead through deposit', () => {
    expect(projectOwnerRequired('contacted')).toBe(true);
    expect(projectOwnerRequired('site_visit')).toBe(true);
    expect(projectOwnerRequired('deposit')).toBe(true);
    expect(projectOwnerRequired('scheduled')).toBe(false);
  });

  it('keeps automation ahead of manual work and falls back to the project owner', () => {
    const result = resolveProjectPrimaryAction({
      candidates: [
        candidate({ sourceKind: 'manual', sourceId: 'manual-1', title: 'Urgent manual call', category: 'Call', dueAt: '2026-07-19T05:00:00.000Z' }),
        candidate(),
      ],
      owner: owner(),
      staff: STAFF,
      selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'),
      isAdmin: false,
    });
    expect(result.primaryAction).toMatchObject({
      sourceId: 'task-1',
      owner: { userId: null, displayName: 'Jordan' },
      ownerSource: 'project_owner',
    });
  });

  it('orders overdue customer work, other overdue work, today, then future deterministically', () => {
    const result = resolveProjectPrimaryAction({
      candidates: [
        candidate({ sourceId: 'future', dueAt: '2026-07-22T05:00:00.000Z' }),
        candidate({ sourceId: 'today', dueAt: '2026-07-20T08:00:00.000Z' }),
        candidate({ sourceId: 'internal-overdue', sourceType: 'CREATE_DESIGN_PACKAGE', category: 'Design', dueAt: '2026-07-18T05:00:00.000Z' }),
        candidate({ sourceId: 'customer-overdue', sourceType: 'FOLLOWUP_EMAIL', dueAt: '2026-07-19T05:00:00.000Z' }),
      ],
      owner: owner(), staff: STAFF, selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    expect(result.candidates.map((item) => item.sourceId)).toEqual([
      'customer-overdue', 'internal-overdue', 'today', 'future',
    ]);
  });

  it('uses source assignees first and the single project owner for every fallback category', () => {
    const result = resolveProjectPrimaryAction({
      candidates: [
        candidate({ sourceId: 'design', sourceType: 'CREATE_DESIGN_PACKAGE', category: 'Design', assignedTo: 'design-1' }),
        candidate({ sourceId: 'estimate', sourceKind: 'manual', sourceType: null, category: 'Estimate', dueAt: '2026-07-21T05:00:00.000Z' }),
        candidate({ sourceId: 'invalid-assignee', assignedTo: 'deleted-user', dueAt: '2026-07-22T05:00:00.000Z' }),
      ],
      owner: owner('quoting'), staff: STAFF, selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    expect(result.candidates.find((item) => item.sourceId === 'design')?.owner?.userId).toBe('design-1');
    expect(result.candidates.find((item) => item.sourceId === 'estimate')?.owner).toMatchObject({ userId: null, displayName: 'Jordan' });
    expect(result.candidates.find((item) => item.sourceId === 'invalid-assignee')?.owner).toMatchObject({ userId: null, displayName: 'Jordan' });
  });

  it('does not select an undated source task', () => {
    const result = resolveProjectPrimaryAction({
      candidates: [candidate({ dueAt: null })],
      owner: owner(),
      staff: STAFF,
      selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'),
      isAdmin: false,
    });
    expect(result.primaryAction).toBeNull();
    expect(result.candidates[0]).toMatchObject({ requiresDueDate: true, dueState: 'needs_due_date' });
  });

  it('creates a conflict only when a later candidate outranks an explicit selection', () => {
    const selected = candidate({ sourceId: 'selected', dueAt: '2026-07-22T05:00:00.000Z' });
    const baseline = resolveProjectPrimaryAction({
      candidates: [selected], owner: owner(), staff: STAFF, selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    const result = resolveProjectPrimaryAction({
      candidates: [selected, candidate({ sourceId: 'new-overdue', dueAt: '2026-07-19T05:00:00.000Z' })],
      owner: owner(),
      staff: STAFF,
      selection: { sourceKind: 'automation_task', sourceId: 'selected', confirmedOutrankingHash: 'cc_741638a5' },
      now: new Date('2026-07-20T06:00:00.000Z'),
      isAdmin: false,
    });
    expect(baseline.selectionConflict).toBeNull();
    expect(result.primaryAction?.sourceId).toBe('selected');
    expect(result.selectionConflict?.challenger.sourceId).toBe('new-overdue');
    expect(result.selectionConflict?.outrankingCandidates.map((item) => item.sourceId)).toEqual(['new-overdue']);
    expect(result.permissions).toMatchObject({ canComplete: true, canReschedule: false, canSelect: false });

    const adminResult = resolveProjectPrimaryAction({
      candidates: result.candidates.map((item) => candidate({
        sourceKind: item.sourceKind,
        sourceId: item.sourceId,
        dueAt: item.dueAt,
        createdAt: item.createdAt,
      })),
      owner: owner(), staff: STAFF,
      selection: { sourceKind: 'automation_task', sourceId: 'selected', confirmedOutrankingHash: 'cc_741638a5' },
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: true,
    });
    expect(adminResult.permissions).toMatchObject({ canResolveConflict: true, canSelect: false, canReschedule: false });
  });

  it('does not conflict for a newly added lower-ranked candidate or an invalidated selection', () => {
    const selected = candidate({ sourceId: 'selected', dueAt: '2026-07-19T05:00:00.000Z' });
    const baseline = resolveProjectPrimaryAction({
      candidates: [selected], owner: owner(), staff: STAFF, selection: null,
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    const lower = candidate({ sourceId: 'lower', dueAt: '2026-07-22T05:00:00.000Z' });
    const retained = resolveProjectPrimaryAction({
      candidates: [selected, lower], owner: owner(), staff: STAFF,
      selection: { sourceKind: selected.sourceKind, sourceId: selected.sourceId, confirmedOutrankingHash: baseline.candidates[0].selectionBaselineHash },
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    expect(retained.selectionConflict).toBeNull();
    expect(retained.primaryAction?.sourceId).toBe('selected');

    const invalidated = resolveProjectPrimaryAction({
      candidates: [lower], owner: owner(), staff: STAFF,
      selection: { sourceKind: 'automation_task', sourceId: 'completed-task', confirmedOutrankingHash: 'stale' },
      now: new Date('2026-07-20T06:00:00.000Z'), isAdmin: false,
    });
    expect(invalidated.selectionConflict).toBeNull();
    expect(invalidated.primaryAction?.sourceId).toBe('lower');
  });

  it('converts date-only inputs to 5pm Auckland across daylight saving', () => {
    expect(portalDueDateToIso('2026-01-15')).toBe('2026-01-15T04:00:00.000Z');
    expect(portalDueDateToIso('2026-07-15')).toBe('2026-07-15T05:00:00.000Z');
  });
});
