import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const getCostingConfigurationEditor = vi.fn();
const getCostingConfigurationEditorCatalog = vi.fn();
const saveCostingConfigurationDraft = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});

vi.mock('@/lib/costing/configurationAdmin', () => ({
  getCostingConfigurationEditor,
  getCostingConfigurationEditorCatalog,
  saveCostingConfigurationDraft,
}));

const context = { params: Promise.resolve({ versionId: 'draft-1' }) };

describe('/api/admin/costing/configurations/:versionId', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    getCostingConfigurationEditor.mockReset();
    getCostingConfigurationEditorCatalog.mockReset();
    saveCostingConfigurationDraft.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      session: {
        role: 'admin',
        user: { id: 'admin-1', email: 'admin@example.com' },
      },
    });
    getCostingConfigurationEditorCatalog.mockReturnValue({
      materials: [],
      actions: [],
    });
  });

  it('requires the standard admin context before returning draft details', async () => {
    requireAdminContext.mockResolvedValue({
      ok: false,
      response: new Response('Forbidden', { status: 403 }),
    });
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/test'), context);

    expect(response.status).toBe(403);
    expect(getCostingConfigurationEditor).not.toHaveBeenCalled();
  });

  it('returns the validated comparison payload and package-owned editor catalog', async () => {
    getCostingConfigurationEditor.mockResolvedValue({
      version: { id: 'draft-1', status: 'draft' },
      comparison: {
        currentVersionId: null,
        currentSource: 'legacy-overrides',
        baselineConfig: { schemaVersion: 'costing-control.v1' },
        diff: [],
        impact: [],
      },
    });
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/test'), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: { id: 'draft-1', status: 'draft' },
      comparison: {
        currentVersionId: null,
        currentSource: 'legacy-overrides',
        baselineConfig: { schemaVersion: 'costing-control.v1' },
        diff: [],
        impact: [],
      },
      catalog: { materials: [], actions: [] },
    });
  });

  it('maps package validation issues to a typed 422 response', async () => {
    const validationError = Object.assign(new Error('Costing configuration validation failed.'), {
      validationIssues: [{
        path: 'overheads.crewDayHours',
        message: 'Must be a finite number between 1 and 24.',
      }],
    });
    saveCostingConfigurationDraft.mockRejectedValue(validationError);
    const { PUT } = await import('./route');
    const response = await PUT(new Request('http://localhost/test', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedContentHash: 'a'.repeat(64),
        expectedUpdatedAt: '2026-07-23T01:00:00.000Z',
        config: { schemaVersion: 'costing-control.v1' },
        name: 'August supplier update',
        purpose: 'Refresh supported material rates.',
      }),
    }), context);

    expect(saveCostingConfigurationDraft).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'admin-1', email: 'admin@example.com' },
      'draft-1',
      'a'.repeat(64),
      '2026-07-23T01:00:00.000Z',
      { schemaVersion: 'costing-control.v1' },
      {
        name: 'August supplier update',
        purpose: 'Refresh supported material rates.',
      },
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: 'Validation failed',
      issues: [{
        path: 'overheads.crewDayHours',
        message: 'Must be a finite number between 1 and 24.',
      }],
    });
  });
});
