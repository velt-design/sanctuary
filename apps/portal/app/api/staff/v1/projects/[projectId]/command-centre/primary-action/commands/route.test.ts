import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectCommandCentre = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
let auditRows: unknown[] = [];

vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/projects/commandCentre/getProjectCommandCentre', () => ({ getProjectCommandCentre }));

const projectId = 'proj_11111111-1111-4111-8111-111111111111';
const commandId = '22222222-2222-4222-8222-222222222222';
const sourceId = '33333333-3333-4333-8333-333333333333';
const ctx = { params: Promise.resolve({ projectId }) };
const candidate = {
  sourceKind: 'automation_task', sourceId, title: 'Review lead', category: 'Other', sourceLabel: 'Automation task',
  sourceType: 'REVIEW_NEW_LEAD', owner: null, dueAt: '2026-07-20T05:00:00.000Z', dueState: 'overdue', dueLabel: 'Overdue',
  isCustomerFacing: true, isCritical: false, criticalReason: null, rescheduleCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-19T00:00:00.000Z', requiresDueDate: false,
  isExplicitlySelected: false, selectionBaselineHash: 'cc_baseline',
};
const state = {
  projectId,
  workModel: 'legacy' as const,
  operations: {
    primaryAction: candidate, candidates: [candidate], candidateRevision: 'cc_revision', manualSelectionBaselineHash: 'cc_manual',
    selectionConflict: null,
  },
};

function request(body: unknown) {
  return new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre/primary-action/commands`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST primary-action commands', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { replayed: false }, error: null });
    auditRows = [];
    from.mockReset().mockImplementation(() => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve({ data: auditRows, error: null })),
      };
      return query;
    });
    requireStaffContext.mockReset().mockResolvedValue({
      ok: true, session: { user: { id: sourceId }, role: 'staff' }, supabase: { rpc, from },
    });
    getProjectCommandCentre.mockReset().mockResolvedValue(state);
  });

  it('creates a dated manual action at 5pm Auckland through the transactional command', async () => {
    const { POST } = await import('./route');
    const res = await POST(request({ command: 'create_manual', commandId, title: 'Call the customer', category: 'Call', dueDate: '2026-07-21', expectedCandidateRevision: 'cc_revision' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('project_command_action', expect.objectContaining({
      p_command_id: commandId,
      p_payload: expect.objectContaining({ dueAt: '2026-07-21T05:00:00.000Z' }),
    }));
  });

  it('freezes regular staff mutations during a selection conflict except completion', async () => {
    getProjectCommandCentre.mockResolvedValueOnce({
      ...state,
      operations: {
        ...state.operations,
        selectionConflict: { current: candidate, challenger: candidate, outrankingCandidates: [candidate] },
      },
    });
    const { POST } = await import('./route');
    const res = await POST(request({ command: 'reschedule', commandId, sourceKind: 'automation_task', sourceId, dueDate: '2026-07-22', expectedUpdatedAt: candidate.updatedAt, expectedCandidateRevision: 'cc_revision' }), ctx);
    expect(res.status).toBe(409);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires a reason for the third reschedule', async () => {
    getProjectCommandCentre.mockResolvedValueOnce({
      ...state,
      operations: { ...state.operations, primaryAction: { ...candidate, rescheduleCount: 2 }, candidates: [{ ...candidate, rescheduleCount: 2 }] },
    });
    const { POST } = await import('./route');
    const res = await POST(request({ command: 'reschedule', commandId, sourceKind: 'automation_task', sourceId, dueDate: '2026-07-22', expectedUpdatedAt: candidate.updatedAt, expectedCandidateRevision: 'cc_revision' }), ctx);
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a stale candidate revision before invoking the command', async () => {
    const { POST } = await import('./route');
    const res = await POST(request({
      command: 'complete', commandId, sourceKind: 'automation_task', sourceId,
      expectedUpdatedAt: candidate.updatedAt, expectedCandidateRevision: 'cc_stale',
    }), ctx);
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns the original success for a semantic command replay after state changes', async () => {
    auditRows = [{
      project_id: '11111111-1111-4111-8111-111111111111',
      event_type: 'primary_action_create_manual',
      after_state: { intent: {
        sourceKind: null, sourceId: null, title: 'Call the customer', category: 'Call',
        dueAt: '2026-07-21T05:00:00.000Z', ownerUserId: null,
      } },
    }];
    const { POST } = await import('./route');
    const res = await POST(request({
      command: 'create_manual', commandId, title: 'Call the customer', category: 'Call',
      dueDate: '2026-07-21', expectedCandidateRevision: 'cc_old_revision',
    }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ command: { committed: true, replayed: true } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns committed success when the authoritative refresh fails', async () => {
    getProjectCommandCentre.mockResolvedValueOnce(state).mockRejectedValueOnce(new Error('refresh failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('./route');
    const res = await POST(request({ command: 'create_manual', commandId, title: 'Call the customer', category: 'Call', dueDate: '2026-07-21', expectedCandidateRevision: 'cc_revision' }), ctx);
    await expect(res.json()).resolves.toMatchObject({ command: { committed: true }, refreshRequired: true });
    errorSpy.mockRestore();
  });

  it('allows admin conflict resolution only to a current outranking action', async () => {
    const lowerCandidate = { ...candidate, sourceId: '44444444-4444-4444-8444-444444444444', title: 'Lower priority work' };
    requireStaffContext.mockResolvedValueOnce({
      ok: true,
      session: { user: { id: sourceId }, role: 'admin' },
      supabase: { rpc, from },
    });
    getProjectCommandCentre.mockResolvedValueOnce({
      ...state,
      operations: {
        ...state.operations,
        candidates: [candidate, lowerCandidate],
        selectionConflict: { current: candidate, challenger: candidate, outrankingCandidates: [candidate] },
      },
    });
    const { POST } = await import('./route');
    const res = await POST(request({
      command: 'resolve_conflict', commandId, resolution: 'select_candidate',
      sourceKind: lowerCandidate.sourceKind, sourceId: lowerCandidate.sourceId,
      expectedUpdatedAt: lowerCandidate.updatedAt, expectedCandidateRevision: 'cc_revision',
    }), ctx);
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
});
