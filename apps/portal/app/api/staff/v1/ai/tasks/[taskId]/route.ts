import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import {
  AiActivityReadError,
  getAiActivityTaskDetail,
} from '@/lib/ai/serverActivity';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateNoStore<T extends Response>(response: T): T {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export async function GET(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/ai/tasks/[taskId]');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);

  const { taskId: rawTaskId } = await ctx.params;
  const taskId = typeof rawTaskId === 'string' ? rawTaskId.trim() : '';
  if (!UUID_PATTERN.test(taskId)) {
    return privateNoStore(jsonError('Invalid AI task id', 400, diagnostics));
  }

  try {
    const detail = await getAiActivityTaskDetail(auth.supabase, taskId);
    if (!detail) {
      return privateNoStore(jsonError('AI task not found', 404, diagnostics, {
        code: 'AI_TASK_NOT_FOUND',
      }));
    }
    return privateNoStore(jsonOk({
      ...detail,
      generatedAt: new Date().toISOString(),
    }, 200, diagnostics));
  } catch (error) {
    if (error instanceof AiActivityReadError) {
      if (error.kind === 'unauthorized') {
        return privateNoStore(jsonError('Unauthorized', 401, diagnostics, { code: 'SESSION_ENDED' }));
      }
      if (error.kind === 'forbidden') {
        return privateNoStore(jsonError('Forbidden', 403, diagnostics, { code: 'AI_ACTIVITY_FORBIDDEN' }));
      }
      if (error.kind === 'schema_not_ready') {
        return privateNoStore(jsonError('AI activity is not ready', 503, diagnostics, {
          code: 'AI_ACTIVITY_SCHEMA_NOT_READY',
        }));
      }
    }
    logPortalServerError(diagnostics, {
      event: 'ai.activity.detail_failed',
      status: 500,
      message: 'Failed to load AI task activity',
      error,
    });
    return privateNoStore(jsonError('Failed to load AI task activity', 500, diagnostics, {
      code: 'AI_ACTIVITY_FAILED',
    }));
  }
}
