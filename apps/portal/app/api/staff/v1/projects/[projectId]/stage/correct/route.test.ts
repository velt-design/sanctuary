import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  uuidFromAppId: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: mocks.uuidFromAppId,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, any> = {};
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(async () => result);
  return builder;
}

function createSupabase() {
  const previousProject = chain({
    data: { id: PROJECT_UUID, pipeline_stage: 'SCHEDULED', name: 'Deck Build' },
    error: null,
  });
  const updatedProject = {
    id: PROJECT_UUID,
    pipeline_stage: 'QUOTING',
    name: 'Deck Build',
  };
  const update = vi.fn(() => chain({ data: updatedProject, error: null }));
  const auditInsert = vi.fn(async (_event: Record<string, any>) => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn(() => previousProject),
        update,
      };
    }
    if (table === 'audit_events') return { insert: auditInsert };
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from }, from, update, auditInsert, updatedProject };
}

describe('POST /api/staff/v1/projects/[projectId]/stage/correct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uuidFromAppId.mockReturnValue(PROJECT_UUID);
  });

  it('records a rollback without touching retired legacy task checks', async () => {
    const supabase = createSupabase();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' }, role: 'admin' },
      supabase: supabase.client,
    });

    const response = await POST(
      new Request(
        `http://localhost/api/staff/v1/projects/${PROJECT_ID}/stage/correct`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ toStage: 'QUOTING', reason: 'Corrected record' }),
        },
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      project: supabase.updatedProject,
      rollback: true,
      silent: true,
    });
    expect(body).not.toHaveProperty('resetManualTaskCount');
    expect(supabase.from).not.toHaveBeenCalledWith('project_task_checks');

    const auditEvent = supabase.auditInsert.mock.calls[0][0];
    expect(auditEvent.payload).toEqual(expect.objectContaining({
      fromStage: 'SCHEDULED',
      toStage: 'QUOTING',
      rollback: true,
      reason: 'Corrected record',
      silent: true,
    }));
    expect(auditEvent.payload).not.toHaveProperty('resetManualTaskCount');
  });
});
