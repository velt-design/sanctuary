import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});

describe('GET /api/admin/performance/web-vitals', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    requireAdminContext.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [{
        route_template: '/dashboard',
        metric_name: 'INP',
        sample_count: 20,
        p75: 180.2,
        p95: 260.4,
        poor_count: 2,
      }],
      error: null,
    });
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { rpc },
      session: { user: { id: 'admin-1' }, role: 'admin' },
    });
  });

  it('enforces admin access', async () => {
    requireAdminContext.mockResolvedValue({ ok: false, response: new Response('{}', { status: 403 }) });
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/admin/performance/web-vitals?days=7'));
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns an identifier-free percentile summary', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/admin/performance/web-vitals?days=30'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('portal_performance_summary', { p_days: 30 });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      days: 30,
      rows: [{
        routeTemplate: '/dashboard',
        metricName: 'INP',
        sampleCount: 20,
        p75: 180.2,
        p95: 260.4,
        poorCount: 2,
      }],
    }));
  });

  it('rejects unsupported retention windows', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/admin/performance/web-vitals?days=90'));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
