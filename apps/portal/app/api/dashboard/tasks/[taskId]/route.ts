import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { setDashboardTaskCompleted } from '@/lib/dashboard/tasks';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateTaskId(taskId: unknown): string | null {
  if (typeof taskId !== 'string') return null;
  const trimmed = taskId.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const { taskId } = await ctx.params;
  const validTaskId = validateTaskId(taskId);
  if (!validTaskId) return jsonError('Invalid taskId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  if (typeof parsed.body?.completed !== 'boolean') return jsonError('completed must be a boolean', 400);

  try {
    const task = await setDashboardTaskCompleted(
      auth.supabase,
      auth.session.user.id,
      validTaskId,
      parsed.body.completed,
    );
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update dashboard task.';
    return jsonError(message, 500);
  }
}
