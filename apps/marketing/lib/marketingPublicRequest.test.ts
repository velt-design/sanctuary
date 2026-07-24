import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAllowedMarketingOrigin,
  marketingAbuseKey,
  readBoundedJson,
  takeMarketingRateLimit,
} from './marketingPublicRequest';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('marketing public request boundaries', () => {
  it('allows exact origins and rejects cross-origin or originless production posts', () => {
    expect(isAllowedMarketingOrigin(new Request('https://example.test/api/enquiry', {
      headers: { Origin: 'https://example.test' },
    }))).toBe(true);
    expect(isAllowedMarketingOrigin(new Request('https://example.test/api/enquiry', {
      headers: { Origin: 'https://attacker.test' },
    }))).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    expect(isAllowedMarketingOrigin(new Request('https://example.test/api/enquiry'))).toBe(false);
  });

  it('creates stable, non-plain-text abuse keys from the forwarded client address', () => {
    vi.stubEnv('MARKETING_ABUSE_HASH_SECRET', 'test-hmac-secret');
    const first = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    }));
    const same = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    }));
    const other = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.6' },
    }));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).not.toContain('203.0.113.5');
  });

  it('derives a production-safe abuse key from the required service credential', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MARKETING_ABUSE_HASH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

    const first = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    }));
    const same = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    }));
    const other = marketingAbuseKey(new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.6' },
    }));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).not.toContain('203.0.113.5');
  });

  it('still fails closed in production when no server-side secret exists', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MARKETING_ABUSE_HASH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    expect(() => marketingAbuseKey(new Request('https://example.test')))
      .toThrow('A server-side marketing abuse hash secret is required');
  });

  it('fails closed when the durable limiter is unavailable and preserves retry timing', async () => {
    const unavailable = await takeMarketingRateLimit({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('database details') }),
    } as any, {
      scope: 'enquiry_submit',
      keyHash: 'a'.repeat(64),
      maxHits: 6,
      windowSeconds: 600,
    });
    const limited = await takeMarketingRateLimit({
      rpc: vi.fn().mockResolvedValue({
        data: [{ allowed: false, retry_after_seconds: 47 }],
        error: null,
      }),
    } as any, {
      scope: 'enquiry_submit',
      keyHash: 'a'.repeat(64),
      maxHits: 6,
      windowSeconds: 600,
    });

    expect(unavailable).toEqual({ ok: false, retryAfterSeconds: 60, unavailable: true });
    expect(limited).toEqual({ ok: false, retryAfterSeconds: 47 });
  });

  it('rejects advertised and actual JSON bodies above the configured cap', async () => {
    await expect(readBoundedJson(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-length': '1000' },
      body: '{}',
    }), 20)).resolves.toBeNull();
    await expect(readBoundedJson(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(40) }),
    }), 20)).resolves.toBeNull();
  });
});
