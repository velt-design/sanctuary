import { AI_TASK_STATUSES, type AiTaskStatus } from '@sp/ai';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import {
  AI_ACTIVITY_DEFAULT_LIMIT,
  AI_ACTIVITY_MAX_LIMIT,
} from '@/lib/ai/activityContract';
import {
  AiActivityReadError,
  listAiActivityTasks,
} from '@/lib/ai/serverActivity';

export const runtime = 'nodejs';

function privateNoStore<T extends Response>(response: T): T {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

function parseStatus(value: string | null): AiTaskStatus | null | undefined {
  if (value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return AI_TASK_STATUSES.includes(normalized as AiTaskStatus)
    ? normalized as AiTaskStatus
    : undefined;
}

function parseLimit(value: string | null): number | null {
  if (value === null || value.trim() === '') return AI_ACTIVITY_DEFAULT_LIMIT;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= AI_ACTIVITY_MAX_LIMIT
    ? parsed
    : null;
}

function activityReadErrorResponse(error: AiActivityReadError, diagnostics: ReturnType<typeof createRouteDiagnostics>) {
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
  return null;
}

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/ai/tasks');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);

  const searchParams = new URL(req.url).searchParams;
  const status = parseStatus(searchParams.get('status'));
  const limit = parseLimit(searchParams.get('limit'));
  if (status === undefined) {
    return privateNoStore(jsonError('Invalid AI task status', 400, diagnostics));
  }
  if (limit === null) {
    return privateNoStore(jsonError(`limit must be an integer from 1 to ${AI_ACTIVITY_MAX_LIMIT}`, 400, diagnostics));
  }

  try {
    const tasks = await listAiActivityTasks(auth.supabase, { status, limit });
    return privateNoStore(jsonOk({
      tasks,
      query: { status, limit },
      generatedAt: new Date().toISOString(),
    }, 200, diagnostics));
  } catch (error) {
    if (error instanceof AiActivityReadError) {
      const response = activityReadErrorResponse(error, diagnostics);
      if (response) return response;
    }
    logPortalServerError(diagnostics, {
      event: 'ai.activity.list_failed',
      status: 500,
      message: 'Failed to load AI activity',
      error,
    });
    return privateNoStore(jsonError('Failed to load AI activity', 500, diagnostics, {
      code: 'AI_ACTIVITY_FAILED',
    }));
  }
}
