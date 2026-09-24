import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { readStaffMeta } from '@/lib/marketingIntegrations/meta/staffRead';

export const runtime = 'nodejs';
function privateResponse<T extends Response>(response: T): T { response.headers.set('Cache-Control', 'private, no-store'); return response; }
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.', 403));
  if (new URL(request.url).search || request.body) return privateResponse(jsonError('This read accepts no filters or actions.', 400));
  try {
    const evidence = await readStaffMeta(AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    return privateResponse(jsonOk({ evidence }));
  } catch {
    return privateResponse(jsonError('The saved Meta report is unavailable. No partial figures are shown.', 503));
  }
}
