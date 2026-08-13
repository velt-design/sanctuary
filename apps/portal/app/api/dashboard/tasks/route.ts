import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createDashboardTask, normalizeDashboardTaskTitle } from '@/lib/dashboard/tasks';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const title = normalizeDashboardTaskTitle(parsed.body?.title);
  if (!title) return jsonError('Task title required', 400);

  let taskId: string | undefined;
  if (typeof parsed.body?.taskId === 'string' && parsed.body.taskId.trim()) {
    try {
      taskId = uuidFromAppId(parsed.body.taskId);
    } catch {
      return jsonError('Invalid task id', 400);
    }
  }

  try {
    const task = await createDashboardTask(auth.supabase, auth.session.user.id, title, taskId);
    return jsonOk({ task }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create dashboard task.';
    return jsonError(message, 500);
  }
}
