import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calculateSimpleCoverPublicResult: vi.fn(),
}));

vi.mock('@/lib/simpleCoverPricing.server', () => ({
  calculateSimpleCoverPublicResult: h.calculateSimpleCoverPublicResult,
}));

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/simple-cover-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/simple-cover-price', () => {
  beforeEach(() => {
    h.calculateSimpleCoverPublicResult.mockReset();
  });

  it('returns only the customer-safe frozen result with no-store headers', async () => {
    h.calculateSimpleCoverPublicResult.mockResolvedValue({
      ok: true,
      status: 'priced',
      input: { widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'facade' },
      areaM2: 18,
      postCount: 3,
      postSpacingMm: 3_000,
      plan: { postPositions: [0, 0.5, 1], rafterPositions: [0, 0.5, 1] },
      price: { fromIncGst: 24_250, currency: 'NZD' },
      configuration: { versionNumber: 7 },
      internalTrueCostExGst: 12_345,
      costingConfiguration: { versionId: 'private-id', contentHash: 'private-hash' },
    });
    const { POST } = await import('./route');

    const response = await POST(request({ widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'facade' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body.price).toEqual({ fromIncGst: 24_250, currency: 'NZD' });
    expect(JSON.stringify(body)).not.toMatch(/cost_ex_gst|materials|install|contentHash|versionId|internalTrueCost/);
  });

  it('rejects out-of-contract dimensions before costing', async () => {
    const { POST } = await import('./route');
    const response = await POST(request({ widthMm: 6_050, projectionMm: 3_000, level: 'ground', connection: 'fascia' }));

    expect(response.status).toBe(422);
    expect(h.calculateSimpleCoverPublicResult).not.toHaveBeenCalled();
  });

  it('fails closed without leaking the configuration error', async () => {
    h.calculateSimpleCoverPublicResult.mockRejectedValue(new Error('supplier rate row and secret details'));
    const { POST } = await import('./route');
    const response = await POST(request({ widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'soffit' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(JSON.stringify(body)).not.toContain('supplier rate');
  });

  it('rejects cross-origin production requests', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { POST } = await import('./route');
    const response = await POST(request(
      { widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'fascia' },
      { Origin: 'https://attacker.example' },
    ));
    vi.unstubAllEnvs();

    expect(response.status).toBe(403);
    expect(h.calculateSimpleCoverPublicResult).not.toHaveBeenCalled();
  });
});
