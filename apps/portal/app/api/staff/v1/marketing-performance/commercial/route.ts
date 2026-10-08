import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { validPeriod } from '@/lib/marketingPerformance/contract';
import { commercialSchema } from '@/lib/marketingPerformance/commercial';

export const runtime = 'nodejs';
function privateResponse<T extends Response>(response: T): T { response.headers.set('Cache-Control', 'private, no-store'); return response; }
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.', 403));
  const query = new URL(request.url).searchParams, start = query.get('start') ?? '', end = query.get('end') ?? '';
  if ([...query.keys()].some(key => !['start', 'end'].includes(key) || query.getAll(key).length !== 1) || !validPeriod(start, end))
    return privateResponse(jsonError('Choose up to 366 days ending today or earlier.', 400));
  try {
    const { data, error } = await staff.supabase.rpc('marketing_commercial_performance_read', { p_start: start, p_end: end });
    if (error) return privateResponse(jsonError(error.code === '42501' ? 'Developer access is required.' : error.code === '54000'
      ? 'Commercial reporting limit reached. No partial totals are shown.' : 'Commercial reporting is unavailable in this environment. Retry.', error.code === '42501' ? 403 : 503));
    const report = commercialSchema.safeParse(data);
    if (!report.success || report.data.start !== start || report.data.end !== end) return privateResponse(jsonError('Commercial evidence could not be verified.', 503));
    return privateResponse(jsonOk({ report: report.data }));
  } catch { return privateResponse(jsonError('Commercial reporting could not be loaded. Retry.', 503)); }
}
