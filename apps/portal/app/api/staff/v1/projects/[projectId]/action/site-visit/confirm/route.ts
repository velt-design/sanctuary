import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { isMissingColumnError, missingColumnFromError, parseIso } from '@/lib/api/siteVisitsServer';
import { recordPersistedConfirmedSiteVisitConversion } from '@/lib/marketingAttribution/siteVisitConversion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

async function loadEventRow(
  supabase: SupabaseClient,
  projectUuid: string,
  eventUuid: string | null,
): Promise<{ data: any | null; error: any | null }> {
  const selects = [
    'id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, confirmed_at, updated_at',
    'id, status, scheduled_start, scheduled_end, notes, confirmed_at, updated_at',
    'id, status, scheduled_start, scheduled_end, confirmed_at, updated_at',
  ] as const;

  let lastErr: any | null = null;
  for (const select of selects) {
    for (const orderByUpdatedAt of [true, false] as const) {
      const q = supabase.from('site_visit_events').select(select).eq('project_id', projectUuid);
      if (eventUuid) q.eq('id', eventUuid);

      const res = orderByUpdatedAt ? await (q as any).order('updated_at', { ascending: false }).limit(1) : await (q as any).limit(1);
      if (!res.error) {
        const rows = Array.isArray(res.data) ? res.data : [];
        return { data: rows.length ? rows[0] : null, error: null };
      }

      lastErr = res.error;
      if (!isMissingColumnError(res.error)) break;
      const missing = missingColumnFromError(res.error);
      if (orderByUpdatedAt && missing === 'updated_at') continue;
      break;
    }

    if (lastErr && !isMissingColumnError(lastErr)) break;
  }
  return { data: null, error: lastErr };
}

async function confirmTentativeEvent(
  supabase: SupabaseClient,
  projectUuid: string,
  eventUuid: string,
): Promise<
  | { ok: true; status: string; confirmedAt: string | null }
  | { ok: false; status: 409 | 500; message: string }
> {
  const res = await supabase
    .from('site_visit_events')
    .update({ status: 'CONFIRMED' } as any)
    .eq('project_id', projectUuid)
    .eq('id', eventUuid)
    .eq('status', 'TENTATIVE')
    .select('id, status, confirmed_at')
    .maybeSingle();

  if (res.error) {
    return {
      ok: false,
      status: 500,
      message: res.error.message ?? 'Failed to persist site visit confirmation',
    };
  }
  if (!res.data) {
    return {
      ok: false,
      status: 409,
      message: 'Site visit changed before it could be confirmed. Refresh and try again.',
    };
  }

  const persistedStatus = String((res.data as any).status ?? '').toUpperCase();
  if (persistedStatus !== 'CONFIRMED') {
    return {
      ok: false,
      status: 500,
      message: 'Site visit confirmation could not be verified',
    };
  }
  return {
    ok: true,
    status: persistedStatus,
    confirmedAt:
      typeof (res.data as any).confirmed_at === 'string'
        ? (res.data as any).confirmed_at
        : null,
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const rawId = typeof body.siteVisitEventId === 'string' ? body.siteVisitEventId.trim() : '';
  let eventUuid: string | null = null;
  if (rawId) {
    try {
      eventUuid = uuidFromAppId(rawId, 'sv');
    } catch {
      return jsonError('Invalid siteVisitEventId', 400);
    }
  }

  const rowRes = await loadEventRow(supabase, projectUuid, eventUuid);
  if (rowRes.error || !rowRes.data) return jsonError('Site visit not found', 404);

  const status = String((rowRes.data as any).status ?? '').toUpperCase();
  if (status !== 'TENTATIVE' && status !== 'CONFIRMED') {
    return jsonError('Only a tentative site visit can be confirmed', 409);
  }

  const start = parseIso((rowRes.data as any).scheduled_start);
  const end = parseIso((rowRes.data as any).scheduled_end);
  if (!start) return jsonError('Cannot confirm: scheduled_start is missing', 409);

  const eventId = String((rowRes.data as any).id ?? '');
  const payload = {
    status: 'CONFIRMED' as const,
    scheduledStart: start,
    scheduledEnd: end,
    salespersonId: typeof (rowRes.data as any).assigned_sales_owner_id === 'string' ? (rowRes.data as any).assigned_sales_owner_id : null,
    notes: typeof (rowRes.data as any).notes === 'string' ? (rowRes.data as any).notes : null,
  };

  let persistedStatus = status;
  let confirmedAt: string | null;
  if (status === 'TENTATIVE') {
    const persisted = await confirmTentativeEvent(supabase, projectUuid, eventId);
    if (!persisted.ok) return jsonError(persisted.message, persisted.status);
    persistedStatus = persisted.status;
    confirmedAt = persisted.confirmedAt;
  } else {
    confirmedAt =
      typeof (rowRes.data as any).confirmed_at === 'string'
        ? (rowRes.data as any).confirmed_at
        : null;
  }

  const conversionRecorded = await recordPersistedConfirmedSiteVisitConversion({
    projectId: projectUuid,
    status: persistedStatus,
    confirmedAt,
    scheduledStart: start,
    scheduledEnd: end,
  });
  if (status === 'TENTATIVE' && !conversionRecorded) {
    return jsonError(
      'Site visit was confirmed, but its immutable confirmation time is unavailable',
      500,
    );
  }
  if (!conversionRecorded) {
    return jsonOk({
      ok: true,
      alreadyConfirmed: true,
      trackingReplayed: false,
      scheduledStart: start,
      scheduledEnd: end,
    });
  }

  try {
    await automationRunner.runEvent({
      type: 'ui.action.book_site_visit',
      projectId: projectUuid,
      stage: 'SITE_VISIT',
      // Use the event id to avoid idempotency collisions with prior tentative saves.
      primaryId: `confirm:${eventId}`,
      payload,
    });
  } catch (error) {
    // Confirmation is already authoritative and the idempotent conversion
    // owner above has run. Keep the separate automation failure visible.
    console.error('[site_visit_confirm] automation follow-up failed', error);
  }

  return jsonOk({
    ok: true,
    alreadyConfirmed: status === 'CONFIRMED',
    trackingReplayed: status === 'CONFIRMED' && conversionRecorded,
    scheduledStart: start,
    scheduledEnd: end,
  });
}
