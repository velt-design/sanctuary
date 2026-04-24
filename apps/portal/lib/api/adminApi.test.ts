import { describe, expect, it } from 'vitest';
import { createRouteDiagnostics } from './routeDiagnostics';
import { jsonError, jsonOk } from './adminApi';

describe('adminApi diagnostics responses', () => {
  it('preserves jsonOk payload and adds diagnostics headers', async () => {
    const diagnostics = createRouteDiagnostics(new Request('http://localhost/api/admin'), '/api/admin');

    const res = jsonOk({ ok: true }, 201, diagnostics);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('preserves jsonError payload and propagates x-portal-request-id', async () => {
    const diagnostics = createRouteDiagnostics(
      new Request('http://localhost/api/admin', { headers: { 'x-portal-request-id': 'req_admin_err' } }),
      '/api/admin',
    );

    const res = jsonError('Forbidden', 403, diagnostics);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_admin_err');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
