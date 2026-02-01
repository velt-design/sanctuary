import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prev = await supabaseServer.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const stage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (stage !== 'SITE_VISIT') return jsonError('Invalid stage transition (expected SITE_VISIT)', 409);

  await automationRunner.runEvent({
    type: 'ui.action.complete_site_visit',
    projectId: projectUuid,
    stage: 'SITE_VISIT',
    payload: {},
  });

  return jsonOk({ ok: true });
}

