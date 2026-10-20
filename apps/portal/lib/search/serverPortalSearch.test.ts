import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const statusRead = vi.fn();
const select = vi.fn(() => ({ in: statusRead }));
const from = vi.fn(() => ({ select }));
const getSupabaseServerAuth = vi.fn();

vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth }));

describe('searchPortal', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockClear();
    select.mockClear();
    statusRead.mockReset().mockResolvedValue({ data: [], error: null });
    getSupabaseServerAuth.mockReset();
    getSupabaseServerAuth.mockResolvedValue({ rpc });
  });

  it('preserves ranked groups and enriches only the bounded project IDs', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          access_granted: true,
          entity_kind: null,
        },
        {
          entity_kind: 'project',
          entity_id: '11111111-1111-4111-8111-111111111111',
          name: 'Alex Deck',
          reference: 'Q-1010',
          site_address: '1 Harbour Road',
          contact_name: 'Alex Mason',
          pipeline_stage: 'QUOTING',
          archived_at: null,
        },
        {
          entity_kind: 'project',
          entity_id: '44444444-4444-4444-8444-444444444444',
          name: 'Courtyard Canopy',
          reference: null,
          site_address: '22 Albert Street',
          contact_name: 'Alex Mason',
          pipeline_stage: 'SITE VISIT',
          archived_at: '2026-07-01T00:00:00.000Z',
        },
        {
          entity_kind: 'contact',
          entity_id: '22222222-2222-4222-8222-222222222222',
          name: 'Alex Mason',
          email: 'alex@example.com',
          phone: '021 555 0101',
          address: 'Auckland',
        },
      ],
      error: null,
    });

    statusRead.mockResolvedValue({ data: [
      { id: '11111111-1111-4111-8111-111111111111', project_work_model_versions: { model_version: 2 }, project_operational_states: { state: 'CLOSED', closed_outcome: 'CANCELLED' } },
      { id: '44444444-4444-4444-8444-444444444444', archived_at: '2026-07-01T00:00:00Z', project_work_model_versions: { model_version: 2 }, project_operational_states: { state: 'CLOSED', closed_outcome: 'COMPLETE' } },
    ], error: null });
    const client = { rpc, from } as any;
    const { searchPortal } = await import('./serverPortalSearch');
    const result = await searchPortal(client, '  alex  ');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('portal_search_v1', {
      search_query: 'alex',
      result_limit: 5,
    });
    expect(result.projects).toEqual([
      expect.objectContaining({ name: 'Alex Deck', stage: 'quoting', archived: false }),
      expect.objectContaining({ name: 'Courtyard Canopy', stage: 'site_visit', archived: true }),
    ]);
    expect(result.contacts).toEqual([
      expect.objectContaining({ name: 'Alex Mason', kind: 'contact', email: 'alex@example.com' }),
    ]);
    expect(result.projects[0]?.href).toContain('/staff/projects/proj_');
    expect(result.contacts[0]?.href).toContain('/staff/contacts/ct_');
    expect(statusRead).toHaveBeenCalledWith('id', [
      '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444',
    ]);
    expect(result.projects[0]?.status).toEqual({ workModel: 'v2', effectiveState: 'CLOSED', closedOutcome: 'CANCELLED' });
    expect(result.projects[1]?.status?.effectiveState).toBe('ARCHIVED');
  });

  it.each([
    [{ code: 'PGRST301', message: 'Expired JWT' }, 401],
    [{ code: '42501', message: 'permission denied for table projects' }, undefined],
  ])('does not claim a current status after enrichment access fails', async (error, status) => {
    rpc.mockResolvedValue({ data: [
      { access_granted: true, entity_kind: null },
      { entity_kind: 'project', entity_id: '11111111-1111-4111-8111-111111111111', name: 'QA project', pipeline_stage: 'SCHEDULED' },
    ], error: null });
    statusRead.mockResolvedValue({ data: null, error });
    const { searchPortal } = await import('./serverPortalSearch');
    await expect(searchPortal({ rpc, from } as any, 'QA')).rejects.toMatchObject(status ? { status } : error);
  });

  it('rejects a failed database operation rather than presenting partial groups', async () => {
    const providerError = new Error('database unavailable');
    rpc.mockResolvedValue({ data: null, error: providerError });

    const { searchPortal } = await import('./serverPortalSearch');
    await expect(searchPortal({ rpc } as any, 'alex')).rejects.toBe(providerError);
  });

  it('maps provider authentication rejection to a stable unauthorized error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for function portal_search_v1',
      },
    });

    const { PortalSearchAccessError, searchPortal } = await import('./serverPortalSearch');
    await expect(searchPortal({ rpc } as any, 'alex')).rejects.toEqual(
      new PortalSearchAccessError(401),
    );
  });

  it('rejects an authenticated user without portal membership', async () => {
    rpc.mockResolvedValue({
      data: [{ access_granted: false, entity_kind: null }],
      error: null,
    });

    const { PortalSearchAccessError, searchPortal } = await import('./serverPortalSearch');
    await expect(searchPortal({ rpc } as any, 'alex')).rejects.toEqual(
      new PortalSearchAccessError(403),
    );
  });

  it('treats a missing access row as a broken provider contract, not a forbidden user', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const { PortalSearchAccessError, searchPortal } = await import('./serverPortalSearch');
    await expect(searchPortal({ rpc } as any, 'alex')).rejects.not.toBeInstanceOf(
      PortalSearchAccessError,
    );
  });

  it('creates one cookie-bound client and delegates the request to the verified RPC', async () => {
    rpc.mockResolvedValue({
      data: [{ access_granted: true, entity_kind: null }],
      error: null,
    });

    const { searchPortalForRequest } = await import('./serverPortalSearch');
    await expect(searchPortalForRequest('alex')).resolves.toEqual({ projects: [], contacts: [] });
    expect(getSupabaseServerAuth).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
