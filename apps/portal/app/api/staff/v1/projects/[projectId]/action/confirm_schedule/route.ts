import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
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

  const prev = await supabase.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (fromStage !== 'DEPOSIT') return jsonError('Invalid stage transition (expected DEPOSIT)', 409);

  const updateRes = await supabase
    .from('projects')
    .update({ pipeline_stage: 'SCHEDULED' } as any)
    .eq('id', projectUuid)
    .select('id, pipeline_stage')
    .single();
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update project', 500);

  await automationRunner.runEvent({
    type: 'pipeline.stage_changed',
    projectId: projectUuid,
    stage: 'SCHEDULED',
    payload: { fromStage: 'DEPOSIT', toStage: 'SCHEDULED' },
  });

  await automationRunner.runEvent({
    type: 'ui.action.confirm_schedule',
    projectId: projectUuid,
    stage: 'SCHEDULED',
    payload: {},
  });

  return jsonOk({ ok: true });
}

