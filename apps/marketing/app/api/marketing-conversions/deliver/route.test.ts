import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configFromEnv: vi.fn(),
  processDeliveries: vi.fn(),
  getServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/marketingConversionDelivery', () => ({
  ga4MeasurementProtocolConfigFromEnv: h.configFromEnv,
  processMarketingConversionDeliveries: h.processDeliveries,
}));

vi.mock('@/lib/supabaseService', () => ({
  getServiceSupabase: h.getServiceSupabase,
}));

async function get(secret = 'cron-secret') {
  const { GET } = await import('./route');
  return GET(new Request('http://localhost/api/marketing-conversions/deliver', {
    headers: { Authorization: `Bearer ${secret}` },
  }));
}

describe('GET /api/marketing-conversions/deliver', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    h.configFromEnv.mockReturnValue({
      measurementId: 'G-KGLF83X6JW',
      apiSecret: 'configured-secret',
    });
    h.getServiceSupabase.mockReturnValue({ rpc: vi.fn() });
    h.processDeliveries.mockResolvedValue({
      claimed: 2,
      sent: 1,
      skipped: 1,
      retrying: 0,
      failed: 0,
    });
  });

  it('requires the deployment cron secret before accessing delivery configuration', async () => {
    const response = await get('wrong-secret');
    expect(response.status).toBe(401);
    expect(h.configFromEnv).not.toHaveBeenCalled();
    expect(h.getServiceSupabase).not.toHaveBeenCalled();
  });

  it('fails closed when GA4 server credentials are not configured', async () => {
    h.configFromEnv.mockReturnValueOnce(null);
    const response = await get();
    expect(response.status).toBe(503);
    expect(h.getServiceSupabase).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Marketing conversion delivery unavailable',
    });
  });

  it('returns non-sensitive delivery counts for an authorized invocation', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 2,
      sent: 1,
      skipped: 1,
      retrying: 0,
      failed: 0,
    });
  });
});
