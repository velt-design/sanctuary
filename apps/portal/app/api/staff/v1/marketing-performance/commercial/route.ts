import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { validPeriod } from '@/lib/marketingPerformance/contract';
import { readCommercial } from '@/lib/marketingPerformance/readOverview.server';

export const runtime = 'nodejs';
function privateResponse<T extends Response>(response: T): T { response.headers.set('Cache-Control', 'private, no-store'); return response; }
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.', 403));
  const query = new URL(request.url).searchParams, start = query.get('start') ?? '', end = query.get('end') ?? '';
  if ([...query.keys()].some(key => !['start', 'end'].includes(key) || query.getAll(key).length !== 1) || !validPeriod(start, end))
    return privateResponse(jsonError('Choose up to 366 days ending today or earlier.', 400));
  const result=await readCommercial(staff.supabase,start,end);
  return privateResponse(result.ok?jsonOk({report:result.report}):jsonError(result.error,result.status));
}
