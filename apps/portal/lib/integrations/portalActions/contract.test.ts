import { describe, expect, it } from 'vitest';
import { parsePortalActionExecution, parsePortalActionGrant } from './contract';

const now = Date.parse('2026-09-22T00:00:00Z');
const projectId = '00000000-0000-4000-8000-000000000001';
const commandId = '00000000-0000-4000-8000-000000000002';
const otherProject = '00000000-0000-4000-8000-000000000003';
const expiresAt = '2026-09-22T12:00:00Z';
const close = { commandId, projectId, command: 'CLOSE', expectedRowVersion: 2, expiresAt, outcome: 'LOST_NO_RESPONSE', note: 'Owner approved this exact cleanup record.', cancellationReason: 'Approved pipeline cleanup.' };
const grant = { version: 'portal_actions_v1', environment: 'staging', taskReference: 'synthetic-task', label: 'Synthetic pipeline batch', expiresAt: '2026-09-23T00:00:00Z', projectIds: [projectId], actions: [close] };

describe('Portal action grant contract', () => {
  it('retains the exact bounded approval and permits a read-only grant', () => {
    expect(parsePortalActionGrant(grant, now).actions[0]).toEqual({ ...close, expiresAt: '2026-09-22T12:00:00.000Z' });
    expect(parsePortalActionGrant({ ...grant, actions: [] }, now).actions).toEqual([]);
  });
  it.each([
    { ...grant, environment: 'local' },
    { ...grant, version: 'v2' },
    { ...grant, actorId: projectId },
    { ...grant, projectIds: [] },
    { ...grant, projectIds: [projectId, projectId.toUpperCase()] },
    { ...grant, projectIds: [otherProject] },
    { ...grant, expiresAt: '2026-09-22T00:00:00Z' },
    { ...grant, expiresAt: '2026-11-22T00:00:00Z' },
    { ...grant, expiresAt: '2026-09-22' },
    { ...grant, expiresAt: '2026-09-22T01:00:00Z' },
    { ...grant, actions: [close, { ...close, commandId: otherProject }] },
  ])('rejects invalid scope, caller identity, expiry and duplicate intent', (input) => {
    expect(() => parsePortalActionGrant(input, now)).toThrow('Invalid Portal action grant');
  });
  it.each([
    { ...close, outcome: 'COMPLETE' },
    { ...close, command: 'WAIT' },
    { ...close, expectedRowVersion: '2' },
    { ...close, expectedRowVersion: Number.MAX_SAFE_INTEGER + 1 },
    { ...close, expectedRowVersion: 0 },
    { ...close, expiresAt: '2026-09-24T00:00:00Z' },
    { ...close, note: '' },
    { ...close, note: 'x'.repeat(1001) },
    { ...close, cancellationReason: '' },
    { ...close, reason: 'Unexpected field' },
    { ...close, projectId: 'proj_' + projectId },
  ])('rejects effects outside the close/reopen contract', (action) => {
    expect(() => parsePortalActionGrant({ ...grant, actions: [action] }, now)).toThrow();
  });
  it('requires a separate exact approval to reopen', () => {
    const action = { commandId, projectId, command: 'REOPEN', expectedRowVersion: 3, expiresAt, reason: 'Owner approved reopening.' };
    expect(parsePortalActionGrant({ ...grant, actions: [action] }, now).actions[0].command).toBe('REOPEN');
    expect(() => parsePortalActionGrant({ ...grant, actions: [{ ...action, outcome: 'CANCELLED' }] }, now)).toThrow();
  });
  it('rejects duplicate command IDs across projects and oversized batches', () => {
    expect(() => parsePortalActionGrant({ ...grant, projectIds: [projectId, otherProject], actions: [close, { ...close, projectId: otherProject }] }, now)).toThrow();
    expect(() => parsePortalActionGrant({ ...grant, actions: Array(101).fill(close) }, now)).toThrow();
    expect(() => parsePortalActionGrant({ ...grant, projectIds: Array(1001).fill(projectId) }, now)).toThrow();
  });
});

describe('Portal action execution contract', () => {
  it('accepts only the saved command identity; cannot replace approved payload', () => {
    expect(parsePortalActionExecution({ commandId })).toEqual({ commandId });
    expect(() => parsePortalActionExecution({ commandId, outcome: 'CANCELLED' })).toThrow();
    expect(() => parsePortalActionExecution({ commandId, projectId })).toThrow();
    expect(() => parsePortalActionExecution({ commandId: 'invalid' })).toThrow();
  });
});
