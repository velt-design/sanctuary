import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runProjectArchiveCommand: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/commands', () => ({
  runProjectArchiveCommand: mocks.runProjectArchiveCommand,
}));

import { PATCH } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const CONTEXT = { params: Promise.resolve({ projectId: PROJECT_ID }) };
const INITIAL_PROJECT = { id: PROJECT_UUID, contact_id: null };
const ARCHIVED_PROJECT = {
  id: PROJECT_UUID,
  name: 'Internal fixture',
  archived_at: '2026-08-03T05:00:00.000Z',
};

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, any> = {};
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

function createSupabase(options: {
  role?: 'admin' | 'staff';
  modelVersion?: number | null;
  stateVersion?: number | null;
  refreshError?: { message: string } | null;
} = {}) {
  const initialProject = query({ data: INITIAL_PROJECT, error: null });
  const refreshedProject = query({
    data: options.refreshError ? null : ARCHIVED_PROJECT,
    error: options.refreshError ?? null,
  });
  const model = query({
    data: options.modelVersion === null
      ? null
      : { model_version: options.modelVersion ?? 2 },
    error: null,
  });
  const state = query({
    data: options.stateVersion === null
      ? null
      : { row_version: options.stateVersion ?? 3 },
    error: null,
  });
  const projectsUpdate = vi.fn((payload: Record<string, unknown>) => {
    const builder: Record<string, any> = {};
    builder.match = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.single = vi.fn(async () => ({
      data: {
        ...ARCHIVED_PROJECT,
        archived_at: payload.archived_at,
      },
      error: null,
    }));
    return builder;
  });
  const from = vi.fn((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn((selection: string) =>
          selection === '*' ? refreshedProject : initialProject),
        update: projectsUpdate,
      };
    }
    if (table === 'project_work_model_versions') {
      return { select: vi.fn(() => model) };
    }
    if (table === 'project_operational_states') {
      return { select: vi.fn(() => state) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return {
    client: { from },
    from,
    projectsUpdate,
    role: options.role ?? 'admin',
  };
}

function request(
  archivedAt: string | null = '2026-08-03T05:00:00.000Z',
) {
  return new Request(
    `http://localhost/api/projects/${PROJECT_ID}/details`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: { archivedAt },
        commandId: COMMAND_ID,
        reason: archivedAt ? 'Project is no longer active' : 'Project resumed',
      }),
    },
  );
}

describe('PATCH /api/projects/[projectId]/details V2 archive branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runProjectArchiveCommand.mockResolvedValue({
      replayed: false,
      rowVersion: 4,
    });
  });

  it.each([
    ['archive', '2026-08-03T05:00:00.000Z', true],
    ['restore', null, false],
  ] as const)(
    'routes a V2 %s through the transactional archive owner',
    async (_label, archivedAt, archived) => {
      const supabase = createSupabase();
      mocks.requireStaffContext.mockResolvedValue({
        ok: true,
        session: { user: { id: 'admin-1' }, role: supabase.role },
        supabase: supabase.client,
      });

      const response = await PATCH(request(archivedAt), CONTEXT);

      expect(response.status).toBe(200);
      expect(mocks.runProjectArchiveCommand).toHaveBeenCalledWith(
        supabase.client,
        {
          projectId: PROJECT_UUID,
          commandId: COMMAND_ID,
          archived,
          expectedStateVersion: 3,
          reason: archived ? 'Project is no longer active' : 'Project resumed',
        },
      );
      expect(supabase.projectsUpdate).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        project: ARCHIVED_PROJECT,
        contact: null,
      });
    },
  );

  it.each([
    ['archive', '2026-08-03T05:00:00.000Z'],
    ['restore', null],
  ] as const)('requires an admin before invoking the V2 %s owner', async (_label, archivedAt) => {
    const supabase = createSupabase({ role: 'staff' });
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'staff-1' }, role: supabase.role },
      supabase: supabase.client,
    });

    const response = await PATCH(request(archivedAt), CONTEXT);

    expect(response.status).toBe(403);
    expect(mocks.runProjectArchiveCommand).not.toHaveBeenCalled();
    expect(supabase.projectsUpdate).not.toHaveBeenCalled();
  });

  it('reports a committed V2 archive when the project refresh fails', async () => {
    const supabase = createSupabase({
      refreshError: { message: 'Project refresh unavailable' },
    });
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' }, role: supabase.role },
      supabase: supabase.client,
    });

    const response = await PATCH(request(), CONTEXT);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      command: {
        id: COMMAND_ID,
        committed: true,
        replayed: false,
        rowVersion: 4,
      },
      refreshRequired: true,
    });
  });

  it('maps a stale archive command to 409', async () => {
    const supabase = createSupabase();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' }, role: supabase.role },
      supabase: supabase.client,
    });
    mocks.runProjectArchiveCommand.mockRejectedValueOnce(
      Object.assign(new Error('state changed'), { code: '40001' }),
    );

    const response = await PATCH(request(), CONTEXT);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'state changed',
      code: 'STALE_STATE',
    });
  });

  it('fails closed when a V2 operational state is unavailable', async () => {
    const supabase = createSupabase({ stateVersion: null });
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' }, role: supabase.role },
      supabase: supabase.client,
    });

    const response = await PATCH(request(), CONTEXT);

    expect(response.status).toBe(503);
    expect(mocks.runProjectArchiveCommand).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/projects/[projectId]/details legacy archive branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['archive', '2026-08-03T05:00:00.000Z'],
    ['restore', null],
  ] as const)('rejects a non-admin legacy %s', async (_label, archivedAt) => {
    const supabase = createSupabase({ role: 'staff', modelVersion: 1 });
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'staff-1' }, role: supabase.role },
      supabase: supabase.client,
    });

    const response = await PATCH(request(archivedAt), CONTEXT);

    expect(response.status).toBe(403);
    expect(supabase.projectsUpdate).not.toHaveBeenCalled();
    expect(mocks.runProjectArchiveCommand).not.toHaveBeenCalled();
  });

  it.each([
    ['archive', '2026-08-03T05:00:00.000Z'],
    ['restore', null],
  ] as const)('allows an admin to use the legacy %s path', async (_label, archivedAt) => {
    const supabase = createSupabase({ role: 'admin', modelVersion: 1 });
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' }, role: supabase.role },
      supabase: supabase.client,
    });

    const response = await PATCH(request(archivedAt), CONTEXT);

    expect(response.status).toBe(200);
    expect(supabase.projectsUpdate).toHaveBeenCalledWith(expect.objectContaining({
      archived_at: archivedAt,
      updated_at: expect.any(String),
    }));
    expect(mocks.runProjectArchiveCommand).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      project: { archived_at: archivedAt },
      contact: null,
    });
  });
});
