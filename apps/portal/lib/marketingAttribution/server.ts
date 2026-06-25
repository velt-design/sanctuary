import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServiceRole } from '../supabaseClient';

type MarketingConversionEventType =
  | 'marketing.lead_submitted'
  | 'marketing.site_visit_booked'
  | 'marketing.quote_accepted'
  | 'marketing.deposit_received';

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
};

type SupabaseLike = Pick<SupabaseClient, 'from'>;

const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const MAX_STRING_LENGTH = 600;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, MAX_STRING_LENGTH) : null;
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

export function normalizeMarketingAttributionInput(
  value: unknown,
  fallback?: { utm?: unknown; page?: unknown; source?: unknown },
): MarketingAttributionSummary {
  const input = isRecord(value) ? value : {};
  const clickIdsInput = isRecord(input.clickIds) ? input.clickIds : input;
  const clickIds: MarketingAttributionSummary['clickIds'] = {};

  for (const key of CLICK_ID_KEYS) {
    const cleaned = cleanString(clickIdsInput[key]);
    if (cleaned) clickIds[key] = cleaned;
  }

  const utm = {
    ...cleanStringRecord(fallback?.utm, (key) => key.startsWith('utm_')),
    ...cleanStringRecord(input.utm, (key) => key.startsWith('utm_')),
  };

  return {
    source: cleanString(input.source) ?? cleanString(fallback?.source),
    page: cleanString(input.page) ?? cleanString(fallback?.page),
    utm,
    clickIds,
    landingPage: cleanString(input.landingPage),
    referrer: cleanString(input.referrer),
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
  supabase?: SupabaseLike;
}): Promise<void> {
  const supabase = params.supabase ?? supabaseServiceRole;
  const primaryId = cleanString(params.primaryId) ?? 'project';
  const attribution = params.attribution ?? (await loadAttributionForProject(supabase, params.projectId));

  const insertRes = await supabase.from('audit_events').insert({
    project_id: params.projectId,
    type: params.type,
    idempotency_key: `marketing:${params.type}:${params.projectId}:${primaryId}`,
    payload: {
      projectId: params.projectId,
      ...(params.payload ?? {}),
      attribution: attribution ?? null,
    },
  } as any);

  if (!insertRes.error || isIgnorableAuditInsertError(insertRes.error)) return;
  console.error('[marketing_attribution] failed to record conversion event', insertRes.error);
}
