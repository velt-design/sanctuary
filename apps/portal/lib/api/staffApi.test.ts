import { describe, expect, it } from 'vitest';
import { createRouteDiagnostics, measureRouteStep } from './routeDiagnostics';
import { jsonError, jsonOk } from './staffApi';

describe('staffApi diagnostics responses', () => {
  it('preserves jsonOk payload and propagates an incoming request id', async () => {
    const diagnostics = createRouteDiagnostics(
      new Request('http://localhost/api/test', { headers: { 'x-request-id': 'req_staff_ok' } }),
      '/api/test',
    );

    const res = jsonOk({ ok: true }, 200, diagnostics);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(res.headers.get('x-portal-request-id')).toBe('req_staff_ok');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('preserves jsonError payload and adds diagnostics headers', async () => {
    const diagnostics = createRouteDiagnostics(new Request('http://localhost/api/test'), '/api/test');

    const res = jsonError('Boom', 500, diagnostics);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Boom' });
    expect(res.headers.get('x-portal-request-id')).toMatch(/^req_|^[0-9a-f-]{36}$/i);
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('adds safe named step durations without response descriptions', async () => {
    const diagnostics = createRouteDiagnostics(new Request('http://localhost/api/test'), '/api/test');
    await measureRouteStep(diagnostics, 'db_query', async () => undefined);

    const res = jsonOk({ ok: true }, 200, diagnostics);

    expect(res.headers.get('server-timing')).toMatch(/total;dur=[\d.]+, db_query;dur=[\d.]+/);
    expect(res.headers.get('server-timing')).not.toContain('desc=');
  });
});
