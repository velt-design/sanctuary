import { describe, expect, it } from 'vitest';
import { currentProjectWork, projectCurrentStatus } from './projectCurrentStatus';
import type { ProjectPageSnapshot } from './types';
import type { ProjectCommandCentreResponse } from './commandCentre/types';
import type { ProjectWorkProjection } from './workItems/types';

describe('current project status', () => {
  it.each([
    ['CLOSED', 'CANCELLED', 'scheduled', 'Closed · Cancelled'],
    ['CLOSED', 'COMPLETE', 'paid', 'Closed · Complete'],
    ['CLOSED', null, 'scheduled', 'Closed'],
    ['WAITING', null, 'scheduled', 'On hold'],
    ['ARCHIVED', 'CANCELLED', 'scheduled', 'Archived'],
    ['ACTIVE', null, 'scheduled', 'Scheduled'],
    ['ACTIVE', null, 'completed', 'Completed'],
  ] as const)('puts %s before the stored %s pipeline stage', (effectiveState, closedOutcome, stage, label) => {
    const facts = { workModel: 'v2' as const, effectiveState, closedOutcome };
    expect(projectCurrentStatus(stage, facts).label).toBe(label);
  });
  it('does not turn an unknown V2 state into active work', () => {
    expect(projectCurrentStatus('scheduled', null, true).label).toBe('Updating status…');
    expect(projectCurrentStatus('scheduled', { workModel: 'v2', effectiveState: null, closedOutcome: null }).label).toBe('Status unavailable');
    expect(projectCurrentStatus('scheduled', { workModel: 'unknown', effectiveState: null, closedOutcome: null }).label).toBe('Status unavailable');
    expect(projectCurrentStatus('scheduled', { workModel: 'legacy', effectiveState: null, closedOutcome: null }).label).toBe('Scheduled');
  });
});

describe('one matching current projection for header and Overview', () => {
  const projection = (stateRowVersion: number, generatedAt: string, effectiveState: 'ACTIVE' | 'CLOSED' | 'ARCHIVED' = 'ACTIVE') => ({
    projectId: 'proj_1', stateRowVersion, generatedAt, effectiveState,
  }) as ProjectWorkProjection;
  const snapshot = (projectWork?: ProjectWorkProjection) => ({ workModel: 'v2', project: { id: 'proj_1' }, projectWork }) as ProjectPageSnapshot;
  const command = (projectWork: ProjectWorkProjection) => ({ workModel: 'v2', projectId: 'proj_1', projectWork }) as ProjectCommandCentreResponse;
  it('uses the existing command read during summary loading', () => {
    const closed = projection(2, '2026-10-20T01:00:00Z', 'CLOSED');
    expect(currentProjectWork(snapshot(), command(closed))).toBe(closed);
  });
  it('prevents a delayed read undoing a newer close or reopen', () => {
    const closed = projection(2, '2026-10-20T01:00:00Z', 'CLOSED');
    const old = projection(1, '2026-10-20T02:00:00Z');
    expect(currentProjectWork(snapshot(closed), command(old))).toBe(closed);
    expect(currentProjectWork(snapshot(old), command(closed))).toBe(closed);
    const reopened = projection(3, '2026-10-20T03:00:00Z');
    expect(currentProjectWork(snapshot(closed), command(reopened))).toBe(reopened);
  });
  it('uses the newer archive read where the state revision is unchanged', () => {
    const before = projection(2, '2026-10-20T01:00:00Z', 'CLOSED');
    const archived = projection(2, '2026-10-20T02:00:00Z', 'ARCHIVED');
    expect(currentProjectWork(snapshot(before), command(archived))).toBe(archived);
  });
  it('does not borrow another project or silently resolve a model mismatch', () => {
    const current = projection(2, '2026-10-20T01:00:00Z', 'CLOSED');
    expect(currentProjectWork(snapshot(), { ...command(current), projectId: 'proj_other' })).toBeUndefined();
    expect(currentProjectWork(snapshot(current), { workModel: 'legacy', projectId: 'proj_1' } as ProjectCommandCentreResponse)).toBeUndefined();
  });
});
