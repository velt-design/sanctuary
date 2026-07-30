import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  getAuthoritativeProjectWorkProjection: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/getAuthoritativeProjectWorkProjection', () => ({
  getAuthoritativeProjectWorkProjection: mocks.getAuthoritativeProjectWorkProjection,
}));

import { GET } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const PROJECT_WORK = {
  projectId: PROJECT_UUID,
  modelVersion: 2,
  operationalState: 'ACTIVE',
};

function request() {
  return new Request(
    `http://localhost/api/staff/v1/projects/${PROJECT_ID}/work-items`,
    { headers: { 'x-request-id': 'req-work-get' } },
  );
}

function context(projectId = PROJECT_ID) {
  return { params: Promise.resolve({ projectId }) };
}

describe('GET /api/staff/v1/projects/[projectId]/work-items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: SUPABASE,
    });
    mocks.getAuthoritativeProjectWorkProjection.mockResolvedValue(PROJECT_WORK);
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Denied' }, { status }),
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.getAuthoritativeProjectWorkProjection).not.toHaveBeenCalled();
  });

  it('validates the app project ID before reading project work', async () => {
    const response = await GET(request(), context('not-a-project'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid projectId',
      code: 'INVALID_PROJECT',
    });
    expect(mocks.getAuthoritativeProjectWorkProjection).not.toHaveBeenCalled();
  });

  it('returns the private V2 projection', async () => {
    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req-work-get');
    await expect(response.json()).resolves.toEqual({
      projectWork: PROJECT_WORK,
    });
    expect(mocks.getAuthoritativeProjectWorkProjection).toHaveBeenCalledWith(PROJECT_ID, SUPABASE);
  });

  it('keeps unmarked legacy projects outside the V2 endpoint', async () => {
    mocks.getAuthoritativeProjectWorkProjection.mockResolvedValueOnce(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'V2 project not found',
      code: 'NOT_FOUND',
    });
  });

  it('maps an unavailable model schema to a stable 503', async () => {
    mocks.getAuthoritativeProjectWorkProjection.mockRejectedValueOnce(
      Object.assign(new Error('project_work_model_versions is unavailable'), {
        code: '42P01',
      }),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WORK_ITEMS_UNAVAILABLE',
    });
  });
});
