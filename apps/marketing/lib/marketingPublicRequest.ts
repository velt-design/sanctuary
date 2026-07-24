import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MarketingRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; unavailable?: boolean };

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function isAllowedMarketingOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return process.env.NODE_ENV !== 'production';

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(req.url);
    if (originUrl.origin === requestUrl.origin) return true;

    const allowedHosts = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      'sanctuarypergolas.co.nz',
      'www.sanctuarypergolas.co.nz',
      process.env.VERCEL_URL?.trim().toLowerCase() || '',
      process.env.NEXT_PUBLIC_SITE_HOST?.trim().toLowerCase() || '',
      ...(process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => {
          const trimmed = value.trim().toLowerCase();
          try {
            return new URL(trimmed).hostname;
          } catch {
            return trimmed;
          }
        }),
    ]);
    allowedHosts.delete('');
    return originUrl.protocol === 'https:' && allowedHosts.has(originUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getMarketingClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function marketingAbuseHashSecret(): string | Buffer {
  const configuredSecret = process.env.MARKETING_ABUSE_HASH_SECRET?.trim() || '';
  if (configuredSecret) return configuredSecret;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (serviceRoleKey) {
    return createHmac('sha256', serviceRoleKey)
      .update('sanctuary:marketing-public-rate-limit:v1')
      .digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('A server-side marketing abuse hash secret is required');
  }
  return 'local-marketing-abuse-key';
}

export function marketingAbuseKey(req: Request): string {
  return createHmac('sha256', marketingAbuseHashSecret())
    .update(getMarketingClientIp(req))
    .digest('hex');
}

export function secureTokenMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function takeMarketingRateLimit(
  supabase: SupabaseClient,
  params: {
    scope: string;
    keyHash: string;
    maxHits: number;
    windowSeconds: number;
  },
): Promise<MarketingRateLimitResult> {
  const { data, error } = await supabase.rpc('marketing_public_rate_limit_take', {
    p_scope: params.scope,
    p_key_hash: params.keyHash,
    p_max_hits: params.maxHits,
    p_window_seconds: params.windowSeconds,
  });
  if (error) return { ok: false, retryAfterSeconds: 60, unavailable: true };

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.allowed === true) return { ok: true };
  const retryAfterSeconds = Number(row?.retry_after_seconds);
  return {
    ok: false,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : 60,
  };
}

export async function readBoundedJson(
  req: Request,
  maxBytes: number,
): Promise<Record<string, unknown> | null> {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  const raw = await req.text();
  if (!raw || Buffer.byteLength(raw, 'utf8') > maxBytes) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
