import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const STATUSES = new Set(['TENTATIVE', 'CONFIRMED']);

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  if (!STATUSES.has(status)) return jsonError('Invalid status (expected TENTATIVE or CONFIRMED)', 400);

  const scheduledStart = typeof body.scheduledStart === 'string' ? body.scheduledStart.trim() : '';
  if (!scheduledStart) return jsonError('scheduledStart is required', 400);

  const scheduledEnd = typeof body.scheduledEnd === 'string' ? body.scheduledEnd.trim() : null;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prev = await supabase.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (fromStage !== 'SITE_VISIT') return jsonError('Invalid stage transition (expected SITE_VISIT)', 409);

  if (status === 'TENTATIVE') {
    const upsertRes = await supabase
      .from('site_visit_events')
      .upsert(
        {
          project_id: projectUuid,
          status: 'TENTATIVE',
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
        } as any,
        { onConflict: 'project_id' },
      )
      .select('id')
      .single();
    if (upsertRes.error) return jsonError('Failed to save site visit', 500);
    return jsonOk({ ok: true, id: upsertRes.data?.id ?? null });
  }

  await automationRunner.runEvent({
    type: 'ui.action.book_site_visit',
    projectId: projectUuid,
    stage: 'SITE_VISIT',
    primaryId: `confirmed:${scheduledStart}`,
    payload: { status: 'CONFIRMED', scheduledStart, scheduledEnd },
  });

  return jsonOk({ ok: true });
}
