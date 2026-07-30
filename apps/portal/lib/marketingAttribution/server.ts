import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServiceRole } from '../supabaseClient';

type MarketingConversionEventType =
  | 'marketing.lead_submitted'
  | 'marketing.site_visit_booked'
  | 'marketing.quote_accepted'
  | 'marketing.deposit_received'
  | 'marketing.project_lost';

type MarketingAttributionConsent = {
  analytics: boolean;
  marketing: boolean;
  capturedAt?: string;
};

type MarketingAttributionSummary = {
  enquiryRequestId?: string | null;
  source?: string | null;
  page?: string | null;
  utm: Record<string, string>;
  clickIds: {
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
  };
  landingPage?: string | null;
  referrer?: string | null;
  analyticsClientId?: string | null;
  consent?: MarketingAttributionConsent | null;
};

type SupabaseLike = Pick<SupabaseClient, 'from'>;

const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const MAX_STRING_LENGTH = 600;
const GA_CLIENT_ID_PATTERN = /^\d{1,20}\.\d{1,20}$/;
const CONVERSION_REPAIR_WINDOW_MS = 72 * 60 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, MAX_STRING_LENGTH) : null;
}

function cleanAttributionUrl(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const privateSuffixIndex = cleaned.search(/[?#]/);
  return privateSuffixIndex < 0 ? cleaned : cleanString(cleaned.slice(0, privateSuffixIndex));
}

export function normalizeMarketingConversionOccurredAt(
  value: unknown,
): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function recentMarketingConversionOccurrence(
  value: unknown,
  nowMs = Date.now(),
): string | null {
  const occurredAt = normalizeMarketingConversionOccurredAt(value);
  if (!occurredAt) return null;
  const ageMs = nowMs - new Date(occurredAt).valueOf();
  return ageMs >= -CLOCK_SKEW_TOLERANCE_MS
    && ageMs <= CONVERSION_REPAIR_WINDOW_MS
    ? occurredAt
    : null;
}

function cleanStringRecord(value: unknown, allowKey: (key: string) => boolean): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim().toLowerCase();
    if (!allowKey(key)) continue;
    const cleaned = cleanString(rawValue);
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

function cleanConsent(value: unknown): MarketingAttributionConsent | null {
  if (!isRecord(value) || typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean') {
    return null;
  }
  const capturedAt = cleanString(value.capturedAt);
  return {
    analytics: value.analytics,
    marketing: value.marketing,
    ...(capturedAt ? { capturedAt } : null),
  };
}

export function normalizeMarketingAttributionInput(
  value: unknown,
  fallback?: { utm?: unknown; page?: unknown; source?: unknown },
): MarketingAttributionSummary {
  const input = isRecord(value) ? value : {};
  const clickIdsInput = isRecord(input.clickIds) ? input.clickIds : input;
  const clickIds: MarketingAttributionSummary['clickIds'] = {};
  const consent = cleanConsent(input.consent);

  if (consent?.marketing) {
    for (const key of CLICK_ID_KEYS) {
      const cleaned = cleanString(clickIdsInput[key]);
      if (cleaned) clickIds[key] = cleaned;
    }
  }

  const utm = consent?.marketing
    ? {
        ...cleanStringRecord(fallback?.utm, (key) => key.startsWith('utm_')),
        ...cleanStringRecord(input.utm, (key) => key.startsWith('utm_')),
      }
    : {};
  const analyticsClientId = consent?.analytics ? cleanString(input.analyticsClientId) : null;

  return {
    source: cleanString(input.source) ?? cleanString(fallback?.source),
    page: cleanString(input.page) ?? cleanString(fallback?.page),
    utm,
    clickIds,
    landingPage: consent?.marketing ? cleanAttributionUrl(input.landingPage) : null,
    referrer: consent?.marketing ? cleanAttributionUrl(input.referrer) : null,
    analyticsClientId:
      analyticsClientId && GA_CLIENT_ID_PATTERN.test(analyticsClientId)
        ? analyticsClientId
        : null,
    consent,
  };
}

function auditInsertErrorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === 'string' ? error.code : '';
}

function isIgnorableAuditInsertError(error: unknown): boolean {
  const code = auditInsertErrorCode(error);
  return code === '23505' || code === '42P01' || code === 'PGRST205';
}

async function loadAttributionForProject(
  supabase: SupabaseLike,
  projectId: string,
): Promise<MarketingAttributionSummary | null> {
  const res = await supabase
    .from('enquiry_requests')
    .select('id, source, page, utm, raw_payload, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (res.error || !res.data) return null;
  const row = res.data as Record<string, unknown>;
  const rawPayload = isRecord(row.raw_payload) ? row.raw_payload : {};
  const attribution = normalizeMarketingAttributionInput(rawPayload.attribution, {
    utm: row.utm,
    page: row.page,
    source: row.source,
  });

  return {
    ...attribution,
    enquiryRequestId: cleanString(row.id),
  };
}

export async function recordMarketingConversionEvent(params: {
  type: MarketingConversionEventType;
  projectId: string;
  primaryId?: string | null;
  payload?: Record<string, unknown>;
  attribution?: MarketingAttributionSummary | null;
  occurredAt?: string | null;
  supabase?: SupabaseLike;
}): Promise<void> {
  const supabase = params.supabase ?? supabaseServiceRole;
  const primaryId = cleanString(params.primaryId) ?? 'project';
  const attribution = params.attribution ?? (await loadAttributionForProject(supabase, params.projectId));
  const occurredAt = normalizeMarketingConversionOccurredAt(params.occurredAt);

  const insertRes = await supabase.from('audit_events').insert({
    project_id: params.projectId,
    type: params.type,
    idempotency_key: `marketing:${params.type}:${params.projectId}:${primaryId}`,
    ...(occurredAt ? { created_at: occurredAt } : {}),
    payload: {
      projectId: params.projectId,
      ...(params.payload ?? {}),
      attribution: attribution ?? null,
    },
  } as any);

  if (!insertRes.error || isIgnorableAuditInsertError(insertRes.error)) return;
  console.error('[marketing_attribution] failed to record conversion event', insertRes.error);
}
