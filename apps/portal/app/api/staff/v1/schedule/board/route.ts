import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isScheduleBoardBuildError, isScheduleSchemaNotReadyError, loadScheduleBoardResponse } from '@/lib/scheduling/scheduleBoardServer';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  try {
    const board = await loadScheduleBoardResponse({ today: url.searchParams.get('today') ?? undefined });
    return jsonOk(board);
  } catch (error) {
    if (isScheduleSchemaNotReadyError(error)) {
      return jsonError(error.message, 501);
    }
    if (isScheduleBoardBuildError(error)) {
      return jsonError(error.message, 500);
    }
    return jsonError('Failed to load schedule data', 500);
  }
}
