import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { validPeriod } from '@/lib/marketingPerformance/contract';
import { hubSchema } from '@/lib/marketingPerformance/hub';
import { isDeveloper } from '@/lib/developerAccess';
import { readPreviewSnapshot } from '@/lib/marketingPerformance/readSnapshot';
import { SnapshotCoverageError } from '@/lib/marketingPerformance/snapshotData';

export const runtime = 'nodejs';
function privateResponse<T extends Response>(response: T): T { response.headers.set('Cache-Control','private, no-store'); return response; }
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.',403));
  const query = new URL(request.url).searchParams, start = query.get('start') ?? '', end = query.get('end') ?? '';
  if ([...query.keys()].some(key => !['start','end'].includes(key) || query.getAll(key).length !== 1) || !validPeriod(start,end))
    return privateResponse(jsonError('Choose up to 366 days ending today or earlier.',400));
  try {
    const snapshot=await readPreviewSnapshot(start,end);
    if(snapshot)return privateResponse(jsonOk({report:snapshot}));
    const { data, error } = await staff.supabase.rpc('marketing_sales_hub_read',{ p_start:start,p_end:end });
    if (error) return privateResponse(jsonError(error.code === '42501' ? 'Developer access is required.'
      : error.code === '54000' ? 'Reporting limit reached. Narrow the dates; contact your administrator if the portfolio limit persists.'
        : 'The hub read is unavailable in this environment. Retry or contact your administrator.', error.code === '42501' ? 403 : error.code === '54000' ? 422 : 503));
    const report = hubSchema.safeParse(data);
    if (!report.success || report.data.start !== start || report.data.end !== end) return privateResponse(jsonError('The evidence could not be verified. No partial totals are shown.',503));
    return privateResponse(jsonOk({ report:report.data }));
  } catch (error) {
    if(error instanceof SnapshotCoverageError)return privateResponse(jsonError(error.message,422));
    return privateResponse(jsonError('The hub could not be loaded. Please retry.',503));
  }
}
