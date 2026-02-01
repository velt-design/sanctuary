import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingColumnError, missingColumnFromError, parseIso } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

async function loadEventRow(projectUuid: string, eventUuid: string | null): Promise<{ data: any | null; error: any | null }> {
  const selects = [
    'id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, updated_at',
    'id, status, scheduled_start, scheduled_end, notes, updated_at',
    'id, status, scheduled_start, scheduled_end, updated_at',
    'id, status, scheduled_start, scheduled_end',
  ] as const;

  let lastErr: any | null = null;
  for (const select of selects) {
    for (const orderByUpdatedAt of [true, false] as const) {
      const q = supabaseServer.from('site_visit_events').select(select).eq('project_id', projectUuid);
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

async function safeUpdate(projectUuid: string, eventUuid: string, patchIn: Record<string, any>): Promise<void> {
  const patch = { ...patchIn };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await supabaseServer.from('site_visit_events').update(patch as any).eq('project_id', projectUuid).eq('id', eventUuid);
    if (!res.error) return;
    if (isMissingColumnError(res.error)) {
      const missing = missingColumnFromError(res.error);
      if (missing && missing in patch) {
        delete patch[missing];
        continue;
      }
      delete patch.customer_notified;
      delete patch.last_notified_at;
      continue;
    }
    return;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

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

  const rowRes = await loadEventRow(projectUuid, eventUuid);
  if (rowRes.error || !rowRes.data) return jsonError('Site visit not found', 404);

  const start = parseIso((rowRes.data as any).scheduled_start);
  const end = parseIso((rowRes.data as any).scheduled_end);
  if (!start) return jsonError('Cannot confirm: scheduled_start is missing', 409);

  await automationRunner.runEvent({
    type: 'ui.action.book_site_visit',
    projectId: projectUuid,
    stage: 'SITE_VISIT',
    // Use the event id to avoid idempotency collisions with prior tentative saves.
    primaryId: `confirm:${String((rowRes.data as any).id ?? '')}`,
    payload: {
      status: 'CONFIRMED',
      scheduledStart: start,
      scheduledEnd: end,
      salespersonId: typeof (rowRes.data as any).assigned_sales_owner_id === 'string' ? (rowRes.data as any).assigned_sales_owner_id : null,
      notes: typeof (rowRes.data as any).notes === 'string' ? (rowRes.data as any).notes : null,
    },
  });

  await safeUpdate(projectUuid, String((rowRes.data as any).id ?? ''), {
    status: 'CONFIRMED',
    customer_notified: true,
    last_notified_at: new Date().toISOString(),
  });

  return jsonOk({ ok: true, scheduledStart: start, scheduledEnd: end });
}
