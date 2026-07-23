import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const validateCostingConfigurationCandidate = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});
vi.mock('@/lib/costing/configurationAdmin', () => ({ validateCostingConfigurationCandidate }));

describe('/api/admin/costing/validate', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    validateCostingConfigurationCandidate.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: {},
      session: { role: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } },
    });
  });

  it('requires the standard admin guard before validation', async () => {
    requireAdminContext.mockResolvedValue({
      ok: false,
      response: new Response('Forbidden', { status: 403 }),
    });
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ config: {} }),
    }));
    expect(response.status).toBe(403);
    expect(validateCostingConfigurationCandidate).not.toHaveBeenCalled();
  });

  it('returns package-owned cross-field issues without writing configuration', async () => {
    validateCostingConfigurationCandidate.mockReturnValue({
      ok: false,
      issues: [{ path: 'rules.overhangMinM', message: 'Must not exceed the maximum.' }],
    });
    const { POST } = await import('./route');
    const config = { schemaVersion: 'costing-control.v1' };
    const response = await POST(new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    }));
    expect(response.status).toBe(422);
    expect(validateCostingConfigurationCandidate).toHaveBeenCalledWith(config);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      issues: [{ path: 'rules.overhangMinM', message: 'Must not exceed the maximum.' }],
    });
  });
});
