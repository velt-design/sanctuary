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

  const exists = await supabase.from('projects').select('id').eq('id', projectUuid).single();
  if (exists.error || !exists.data) return jsonError('Project not found', 404);

  await automationRunner.runEvent({
    type: 'ui.action.project_created',
    projectId: projectUuid,
    stage: 'NEW',
    payload: { source: 'portal' },
  });

  return jsonOk({ ok: true });
}

