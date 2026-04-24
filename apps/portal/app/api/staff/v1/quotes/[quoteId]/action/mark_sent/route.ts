import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ quoteId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!projectId) return jsonError('projectId is required', 400);

  const { quoteId } = await ctx.params;
  const quoteIdRaw = typeof quoteId === 'string' ? quoteId.trim() : '';
  if (!quoteIdRaw) return jsonError('Invalid quoteId', 400);

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prev = await supabase.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (fromStage !== 'QUOTING') return jsonError('Invalid stage transition (expected QUOTING)', 409);

  const updateRes = await supabase
    .from('projects')
    .update({ pipeline_stage: 'SENT' } as any)
    .eq('id', projectUuid)
    .select('id, pipeline_stage')
    .single();
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update project', 500);

  await automationRunner.runEvent({
    type: 'pipeline.stage_changed',
    projectId: projectUuid,
    stage: 'SENT',
    primaryId: quoteIdRaw,
    payload: { fromStage: 'QUOTING', toStage: 'SENT', quoteId: quoteIdRaw },
  });

  await automationRunner.runEvent({
    type: 'ui.action.quote_mark_sent',
    projectId: projectUuid,
    stage: 'SENT',
    primaryId: quoteIdRaw,
    payload: { quoteId: quoteIdRaw },
  });

  return jsonOk({ ok: true });
}

