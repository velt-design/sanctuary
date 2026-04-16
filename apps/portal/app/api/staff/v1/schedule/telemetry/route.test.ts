import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

describe('POST /api/staff/v1/schedule/telemetry', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires staff authentication', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-portal-request-id': 'req-telemetry-auth' },
      body: JSON.stringify({ event: 'schedule_hydrated', view: 'board' }),
    }));

    expect(res.status).toBe(401);
    expect(res.headers.get('x-portal-request-id')).toBe('req-telemetry-auth');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('logs a sanitized schedule client event and returns ok', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-portal-request-id': 'req-telemetry-1' },
      body: JSON.stringify({
        event: 'fallback_activated',
        view: 'board',
        reason: 'client-schema-not-ready',
        requestId: 'req-client-501',
        counts: { fetchCount: 1.234 },
        timings: { firstVisibleMs: 88.88 },
        meta: { source: 'test' },
        ignored: { nested: 'value' },
      }),
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req-telemetry-1');
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(infoSpy).toHaveBeenCalledWith('[portal]', expect.objectContaining({
      event: 'schedule.client.fallback_activated',
      requestId: 'req-telemetry-1',
      route: '/api/staff/v1/schedule/telemetry',
      method: 'POST',
      view: 'board',
      reason: 'client-schema-not-ready',
      clientRequestId: 'req-client-501',
      counts: { fetchCount: 1.2 },
      timings: { firstVisibleMs: 88.9 },
      meta: { source: 'test' },
    }));
  });

  it('rejects invalid telemetry payloads without throwing', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ view: 'board' }),
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid telemetry event.' });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects oversized telemetry payloads without throwing', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'schedule_hydrated', view: 'board', meta: { source: 'x'.repeat(20_000) } }),
    }));

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'Telemetry payload is too large.' });
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
