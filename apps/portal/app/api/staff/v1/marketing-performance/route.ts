import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { reportSchema, validPeriod } from '@/lib/marketingPerformance/contract';
import { isDeveloper } from '@/lib/developerAccess';
import { readPreviewSnapshot } from '@/lib/marketingPerformance/readSnapshot';
import { SnapshotCoverageError } from '@/lib/marketingPerformance/snapshotData';

export const runtime = 'nodejs';
function privateResponse<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.', 403));
  const query = new URL(request.url).searchParams;
  const start = query.get('start') ?? '', end = query.get('end') ?? '';
  if ([...query.keys()].some(key => !['start', 'end'].includes(key) || query.getAll(key).length !== 1)
    || !validPeriod(start, end)) return privateResponse(jsonError('Choose up to 366 days ending today or earlier.', 400));
  try {
    const snapshot=await readPreviewSnapshot(start,end,true);
    if(snapshot)return privateResponse(jsonOk({report:snapshot.enquiries}));
    const { data, error } = await staff.supabase.rpc('marketing_performance_read', { p_start: start, p_end: end });
    if (error) {
      if (error.code === '42501') return privateResponse(jsonError('Developer access is required.', 403));
      if (error.code === '54000') return privateResponse(jsonError('Too many enquiries. Choose a shorter date range.', 422));
      return privateResponse(jsonError('Marketing reporting is unavailable. Its database read may not be installed; retry or contact your administrator.', 503));
    }
    const report = reportSchema.safeParse(data);
    if (!report.success || report.data.start !== start || report.data.end !== end)
      return privateResponse(jsonError('The reporting evidence could not be verified. Retry before using these totals.', 503));
    return privateResponse(jsonOk({ report: report.data }));
  } catch (error) {
    if(error instanceof SnapshotCoverageError)return privateResponse(jsonError(error.message,422));
    return privateResponse(jsonError('Marketing reporting could not be loaded. Please retry.', 503));
  }
}
