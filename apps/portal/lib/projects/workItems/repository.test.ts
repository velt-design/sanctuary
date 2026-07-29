import { describe, expect, it, vi } from 'vitest';
import { getProjectWorkProjection, getProjectWorkQueue } from './repository';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function query(data: unknown[]) {
  const result = Promise.resolve({ data, error: null });
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: result.then.bind(result),
  };
  return builder;
}

function client(params: {
  archivedAt?: string | null;
  state?: 'ACTIVE' | 'WAITING' | 'CLOSED';
  waitingUntil?: string | null;
  waitingReason?: string | null;
  closedOutcome?: string | null;
  ownerKey?: string | null;
  items?: Array<Record<string, unknown>>;
}) {
  const from = vi.fn((table: string) => {
    if (table === 'projects') {
      return query([{ id: PROJECT_ID, archived_at: params.archivedAt ?? null }]);
    }
    if (table === 'project_work_model_versions') {
      return query([{ model_version: 2 }]);
    }
    if (table === 'project_operational_states') {
      return query([{
        state: params.state ?? 'ACTIVE',
        waiting_until: params.waitingUntil ?? null,
        waiting_reason: params.waitingReason ?? null,
        closed_outcome: params.closedOutcome ?? null,
        row_version: 3,
      }]);
    }
    if (table === 'project_work_items') return query(params.items ?? []);
    if (table === 'project_confirmation_events') return query([]);
    if (table === 'project_owner_assignments') {
      return query(params.ownerKey ? [{ owner_key: params.ownerKey }] : []);
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { from } as any;
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    project_id: PROJECT_ID,
    title: 'Follow up by email',
    responsibility_area: 'CUSTOMER',
    status: 'OPEN',
    due_at: '2026-07-30T05:00:00.000Z',
    sla_breach_at: null,
    deadline_policy: 'LEAD_FOLLOW_UP_V1',
    calendar_revision: 'calendar-1',
    assignee_user_id: null,
    priority: 'NORMAL',
    priority_reason: null,
    blocked_reason: null,
    origin: 'AUTOMATION',
    source_type: 'LEAD_CADENCE',
    source_key: `lead:follow-up:${PROJECT_ID}:v1`,
    series_key: `lead:${PROJECT_ID}:v1`,
    subject_kind: 'PROJECT',
    subject_id: PROJECT_ID,
    row_version: 1,
    created_at: '2026-07-29T00:00:00.000Z',
    updated_at: '2026-07-29T00:00:00.000Z',
    completed_at: null,
    cancelled_at: null,
    outcome: null,
    cancellation_reason: null,
    ...overrides,
  };
}

describe('project work projection', () => {
  const now = new Date('2026-07-29T02:00:00.000Z');

  it('uses an urgent work item before a specialist action', async () => {
    const projection = await getProjectWorkProjection({
      supabase: client({ items: [item({ due_at: '2026-07-28T05:00:00.000Z' })] }),
      projectUuid: PROJECT_ID,
      specialistAction: {
        kind: 'specialist',
        key: 'quote',
        title: 'Prepare quote',
        reason: 'Estimate ready',
        owner: 'Commercial',
        expectedResult: 'Draft quote created',
        href: '/quotes',
      },
      now,
    });

    expect(projection?.primaryAction).toMatchObject({
      kind: 'workItem',
      dueState: 'overdue',
      item: {
        projectId: `proj_${PROJECT_ID}`,
        title: 'Follow up by email',
      },
    });
    expect(projection?.projectId).toBe(`proj_${PROJECT_ID}`);
    expect(projection?.openItems[0]?.effectiveAssignee).toEqual({ kind: 'unassigned' });
  });

  it('uses an explicit staff assignee before the project owner fallback', async () => {
    const assigned = await getProjectWorkProjection({
      supabase: client({
        ownerKey: 'jordan',
        items: [item({ assignee_user_id: '33333333-3333-4333-8333-333333333333' })],
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(assigned?.openItems[0]?.effectiveAssignee).toEqual({
      kind: 'staff',
      userId: '33333333-3333-4333-8333-333333333333',
    });

    const fallback = await getProjectWorkProjection({
      supabase: client({ ownerKey: 'jordan', items: [item()] }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(fallback?.openItems[0]?.effectiveAssignee).toEqual({
      kind: 'projectOwner',
      ownerKey: 'jordan',
    });
  });

  it('surfaces a due waiting-state review but keeps future waiting quiet', async () => {
    const due = await getProjectWorkProjection({
      supabase: client({
        state: 'WAITING',
        waitingUntil: '2026-07-29T01:00:00.000Z',
        waitingReason: 'Customer asked us to wait',
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(due?.primaryAction).toMatchObject({
      kind: 'stateReview',
      title: 'Review waiting project',
      reason: 'Customer asked us to wait',
    });

    const future = await getProjectWorkProjection({
      supabase: client({
        state: 'WAITING',
        waitingUntil: '2026-08-05T05:00:00.000Z',
        waitingReason: 'Customer asked us to wait',
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(future?.primaryAction).toMatchObject({
      kind: 'none',
      title: 'Project waiting',
    });
  });

  it('never presents closed or archived work as actionable', async () => {
    const closed = await getProjectWorkProjection({
      supabase: client({ state: 'CLOSED', closedOutcome: 'LOST_NO_RESPONSE', items: [item()] }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(closed?.primaryAction).toMatchObject({ kind: 'none', title: 'Project closed' });

    const archived = await getProjectWorkProjection({
      supabase: client({ archivedAt: '2026-07-29T01:00:00.000Z', items: [item()] }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(archived?.primaryAction).toMatchObject({ kind: 'none', title: 'Project archived' });
  });
});

describe('project work queue', () => {
  it('exposes explicit, fallback, and unassigned effective owners', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          project_id: PROJECT_ID,
          project_name: 'Explicit owner',
          queue_group: 'today',
          title: 'Send email',
          due_at: '2026-07-29T05:00:00.000Z',
          priority: 'NORMAL',
          blocked_reason: null,
          assignee_user_id: '33333333-3333-4333-8333-333333333333',
          project_owner_key: 'jordan',
        },
        {
          project_id: '44444444-4444-4444-8444-444444444444',
          project_name: 'Project owner',
          queue_group: 'blocked',
          title: 'Resolve blocker',
          due_at: '2026-07-30T05:00:00.000Z',
          priority: 'CRITICAL',
          blocked_reason: 'Supplier response required',
          assignee_user_id: null,
          project_owner_key: 'bruce',
        },
        {
          project_id: '55555555-5555-4555-8555-555555555555',
          project_name: 'Unassigned',
          queue_group: 'needsTriage',
          title: 'Needs triage',
          due_at: null,
          priority: null,
          blocked_reason: null,
          assignee_user_id: null,
          project_owner_key: null,
        },
      ],
      error: null,
    });

    const result = await getProjectWorkQueue(
      { rpc } as any,
      { now: new Date('2026-07-29T02:00:00.000Z') },
    );

    expect(result.entries.map((entry) => entry.effectiveAssignee)).toEqual([
      { kind: 'staff', userId: '33333333-3333-4333-8333-333333333333' },
      { kind: 'projectOwner', ownerKey: 'bruce' },
      { kind: 'unassigned' },
    ]);
  });
});
