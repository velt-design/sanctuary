import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installPortalApiAccessFailureMonitor,
  portalApiAccessFailureForResponse,
} from './portalApiAccessMonitor';

describe('portal API access monitor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('classifies only same-origin API 401 and 403 responses', () => {
    expect(portalApiAccessFailureForResponse(
      '/api/staff/v1/projects',
      new Response(null, { status: 401 }),
      'https://portal.test',
    )).toEqual({ path: '/api/staff/v1/projects', status: 401 });
    expect(portalApiAccessFailureForResponse(
      new Request('https://portal.test/api/admin/access'),
      new Response(null, { status: 403 }),
      'https://portal.test',
    )).toEqual({ path: '/api/admin/access', status: 403 });
    expect(portalApiAccessFailureForResponse(
      '/api/staff/v1/projects',
      new Response(null, { status: 500 }),
      'https://portal.test',
    )).toBeNull();
    expect(portalApiAccessFailureForResponse(
      'https://storage.test/api/private',
      new Response(null, { status: 401 }),
      'https://portal.test',
    )).toBeNull();
    expect(portalApiAccessFailureForResponse(
      '/staff/projects',
      new Response(null, { status: 401 }),
      'https://portal.test',
    )).toBeNull();
  });

  it('observes a response without consuming or replacing it and restores fetch', async () => {
    const response = new Response('{"error":"Unauthorized"}', {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    const originalFetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', originalFetch);
    const observed = vi.fn();
    const uninstall = installPortalApiAccessFailureMonitor(observed);

    await expect(window.fetch('/api/dashboard')).resolves.toBe(response);
    expect(observed).toHaveBeenCalledWith({ path: '/api/dashboard', status: 401 });
    expect(await response.json()).toEqual({ error: 'Unauthorized' });

    uninstall();
    expect(window.fetch).toBe(originalFetch);
  });
});
