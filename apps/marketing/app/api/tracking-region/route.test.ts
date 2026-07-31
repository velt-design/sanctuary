import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/tracking-region', () => {
  it('returns NZ automatic tracking for a trusted NZ country header', async () => {
    const response = GET(new Request('https://example.test/api/tracking-region', {
      headers: { 'x-vercel-ip-country': 'NZ' },
    }));

    await expect(response.json()).resolves.toEqual({ policy: 'nz_automatic' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('fails closed for non-NZ and unknown geography', async () => {
    for (const country of ['AU', null]) {
      const headers = country ? { 'x-vercel-ip-country': country } : undefined;
      const response = GET(new Request('https://example.test/api/tracking-region', { headers }));
      await expect(response.json()).resolves.toEqual({ policy: 'consent_required' });
    }
  });
});
