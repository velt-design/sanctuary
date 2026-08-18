import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_APPROVAL_SAFE_SELECT,
  AI_TASK_EVENT_SAFE_SELECT,
  AI_TASK_SAFE_SELECT,
  AiActivityReadError,
  getAiActivityTaskDetail,
  listAiActivityTasks,
} from './serverActivity';

const TASK_ID = '11111111-1111-4111-8111-111111111111';

const taskRow = {
  id: TASK_ID,
  task_type: 'synthetic.echo',
  agent_key: 'sanctuary.synthetic',
  agent_version: '1.0.0',
  capability_key: 'synthetic.echo',
  capability_version: '1.0.0',
  policy_version: '1.0.0',
  safe_objective: 'Verify the synthetic control path',
  status: 'proposed',
  risk_class: 'low',
  data_classification: 'internal',
  project_id: null,
  parent_task_id: null,
  max_cost_cents: 0,
  actual_cost_cents: 0,
  failure_code: null,
  safe_failure_summary: null,
  created_at: '2026-08-18T00:00:00.000Z',
  updated_at: '2026-08-18T00:00:00.000Z',
  started_at: null,
  completed_at: null,
};

const eventRow = {
  id: 1,
  task_id: TASK_ID,
  sequence: 1,
  event_type: 'created',
  from_status: null,
  to_status: null,
  actor_kind: 'human',
  actor_key: 'portal.staff',
  node_id: null,
  safe_summary: 'Synthetic task recorded.',
  created_at: '2026-08-18T00:00:00.000Z',
};

const approvalRow = {
  id: '22222222-2222-4222-8222-222222222222',
  task_id: TASK_ID,
  action_type: 'synthetic.effect',
  target_type: 'synthetic.fixture',
  target_id: 'echo_v1',
  payload_hash: `sha256:${'a'.repeat(64)}`,
  payload_summary: 'Approve the zero-effect fixture.',
  required_role: 'admin',
  requested_by_kind: 'agent',
  requested_by_key: 'sanctuary.synthetic',
  requested_at: '2026-08-18T00:02:00.000Z',
  expires_at: '2026-08-18T00:17:00.000Z',
  single_use: true,
  impact: ['Records a synthetic decision only.'],
  validations: [{ validationKey: 'synthetic.only', passed: true, evidenceId: null }],
  status: 'pending',
  decision: null,
  decided_by_role: null,
  decided_at: null,
  consumed_at: null,
  invalidation_reason_code: null,
};

type QueryResult = { data: unknown; error: unknown };

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => (
      Promise.resolve(result).then(resolve, reject)
    ),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

describe('AI activity read boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only explicit staff-safe task fields through the supplied auth-bound client', async () => {
    const tasks = queryBuilder({ data: [taskRow], error: null });
    const client = { from: vi.fn().mockReturnValue(tasks) } as unknown as SupabaseClient;

    await expect(listAiActivityTasks(client, { status: 'proposed', limit: 10 })).resolves.toEqual([
      expect.objectContaining({ taskId: TASK_ID, objective: 'Verify the synthetic control path' }),
    ]);
    expect(client.from).toHaveBeenCalledWith('ai_tasks');
    expect(tasks.select).toHaveBeenCalledWith(AI_TASK_SAFE_SELECT);
    expect(tasks.eq).toHaveBeenCalledWith('status', 'proposed');
    expect(tasks.limit).toHaveBeenCalledWith(10);
    expect(AI_TASK_SAFE_SELECT).not.toContain('requested_by_user_id');
    expect(AI_TASK_SAFE_SELECT).not.toContain('idempotency_key');
    expect(AI_TASK_SAFE_SELECT).not.toContain('input_snapshot_hash');
  });

  it('loads detail from public safe tables without any private or service-role path', async () => {
    const tasks = queryBuilder({ data: taskRow, error: null });
    const events = queryBuilder({ data: [eventRow], error: null });
    const approvals = queryBuilder({ data: [approvalRow], error: null });
    const client = {
      from: vi.fn((table: string) => ({
        ai_tasks: tasks,
        ai_task_events: events,
        ai_approvals: approvals,
      })[table]),
    } as unknown as SupabaseClient;

    await expect(getAiActivityTaskDetail(client, TASK_ID)).resolves.toEqual({
      task: expect.objectContaining({ taskId: TASK_ID }),
      events: [expect.objectContaining({ eventKey: '1', eventType: 'created' })],
      approvals: [expect.objectContaining({
        approvalId: approvalRow.id,
        status: 'pending',
        validations: [{ validationKey: 'synthetic.only', passed: true, evidenceId: null }],
      })],
    });
    expect(tasks.select).toHaveBeenCalledWith(AI_TASK_SAFE_SELECT);
    expect(events.select).toHaveBeenCalledWith(AI_TASK_EVENT_SAFE_SELECT);
    expect(approvals.select).toHaveBeenCalledWith(AI_APPROVAL_SAFE_SELECT);
    expect(client.from).toHaveBeenCalledTimes(3);
    expect(client.from).not.toHaveBeenCalledWith('ai_task_payloads');
    expect(client.from).not.toHaveBeenCalledWith('ai_task_command_receipts');
  });

  it('treats an RLS-hidden cross-project task exactly like a missing task', async () => {
    const tasks = queryBuilder({ data: null, error: null });
    const client = { from: vi.fn().mockReturnValue(tasks) } as unknown as SupabaseClient;
    await expect(getAiActivityTaskDetail(client, TASK_ID)).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('classifies an ended request session without leaking provider detail', async () => {
    const tasks = queryBuilder({ data: null, error: { code: 'PGRST301', message: 'jwt detail' } });
    const client = { from: vi.fn().mockReturnValue(tasks) } as unknown as SupabaseClient;
    await expect(listAiActivityTasks(client, { status: null, limit: 25 })).rejects.toMatchObject({
      name: 'AiActivityReadError',
      kind: 'unauthorized',
      message: 'Portal session is no longer valid',
    });
  });

  it('fails closed when a public projection contains an invalid contract enum', async () => {
    const tasks = queryBuilder({ data: [{ ...taskRow, status: 'mystery' }], error: null });
    const client = { from: vi.fn().mockReturnValue(tasks) } as unknown as SupabaseClient;
    await expect(listAiActivityTasks(client, { status: null, limit: 25 })).rejects.toBeInstanceOf(AiActivityReadError);
  });
});
