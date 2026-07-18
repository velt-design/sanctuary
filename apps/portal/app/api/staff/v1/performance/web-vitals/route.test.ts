import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});

const validEvent = {
  name: 'INP',
  value: 123.456,
  rating: 'good',
  routeTemplate: '/staff/projects/[projectId]',
  navigationType: 'navigate',
  deviceClass: 'desktop',
  buildId: 'build-123',
};

describe('POST /api/staff/v1/performance/web-vitals', () => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));

  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    insert.mockReset();
    from.mockClear();
    insert.mockResolvedValue({ error: null });
    requireStaffContext.mockResolvedValue({
      ok: true,
      supabase: { from },
      session: { user: { id: 'user-1' }, role: 'staff' },
    });
  });

  it('requires a staff session', async () => {
    requireStaffContext.mockResolvedValue({ ok: false, response: new Response('{}', { status: 401 }) });
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: JSON.stringify(validEvent),
    }));
    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('retains only the sanitized event and returns accepted', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: JSON.stringify({ ...validEvent, rawUrl: '/staff/projects/private-id?customer=Alice' }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(from).toHaveBeenCalledWith('portal_performance_metrics');
    expect(insert).toHaveBeenCalledWith({
      metric_name: 'INP',
      metric_value: 123.456,
      rating: 'good',
      route_template: '/staff/projects/[projectId]',
      navigation_type: 'navigate',
      device_class: 'desktop',
      build_id: 'build-123',
    });
    expect(JSON.stringify(insert.mock.calls)).not.toContain('Alice');
  });

  it('rejects malformed, oversized and non-finite-compatible events', async () => {
    const { POST } = await import('./route');
    const malformed = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: '{bad',
    }));
    expect(malformed.status).toBe(400);

    const oversized = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: JSON.stringify({ ...validEvent, padding: 'x'.repeat(3_000) }),
    }));
    expect(oversized.status).toBe(413);

    const invalid = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: JSON.stringify({ ...validEvent, value: 'Infinity' }),
    }));
    expect(invalid.status).toBe(400);
  });

  it('keeps storage failures visible without exposing database detail', async () => {
    insert.mockResolvedValue({ error: { code: 'PGRST205', message: 'private detail' } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/performance/web-vitals', {
      method: 'POST',
      body: JSON.stringify(validEvent),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Performance metric could not be retained.' });
    errorSpy.mockRestore();
  });
});
