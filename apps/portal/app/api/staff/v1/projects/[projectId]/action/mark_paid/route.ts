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

  const command = await supabase.rpc('commercial_mark_project_paid', {
    p_project_id: projectUuid,
  });
  if (command.error) {
    const status = String(command.error.message ?? '').includes('required')
      || String(command.error.message ?? '').includes('not fully paid')
      || String(command.error.message ?? '').includes('Invalid stage') ? 409 : 500;
    return jsonError(command.error.message ?? 'Failed to verify commercial balance', status);
  }
  const commandRow = Array.isArray(command.data) ? command.data[0] : command.data;
  const changed = (commandRow as any)?.changed === true;

  if (changed) {
    try {
      await automationRunner.runEvent({
        type: 'pipeline.stage_changed',
        projectId: projectUuid,
        stage: 'PAID',
        payload: { fromStage: 'COMPLETED', toStage: 'PAID' },
      });
      await automationRunner.runEvent({
        type: 'ui.action.mark_paid',
        projectId: projectUuid,
        stage: 'PAID',
        payload: {},
      });
    } catch (error) {
      // Settlement is already committed. Do not turn a follow-up automation
      // failure into a retry prompt for the financial state change.
      console.error('[mark_paid] automation follow-up failed', error);
    }
  }

  return jsonOk({ ok: true, replayed: !changed });
}

