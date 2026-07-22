import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  loadEstimateCostCalibration,
  parseEstimateActualCostInput,
  saveEstimateCostActuals,
} from '@/lib/estimateActuals/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const { estimateId } = await ctx.params;
  try {
    const result = await loadEstimateCostCalibration(auth.supabase, estimateId);
    if ('error' in result) {
      return result.error === 'not_found'
        ? jsonError('Estimate not found', 404)
        : jsonError('Failed to load actual job costs', 500);
    }
    return jsonOk({ comparison: result.comparison });
  } catch {
    return jsonError('Invalid estimateId', 400);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const input = parseEstimateActualCostInput(parsed.body);
  if (!input) return jsonError('Actual costs must be blank or non-negative numbers', 400);
  if (input.isComplete && [input.materialsExGst, input.installExGst, input.overheadExGst].some((value) => value === null)) {
    return jsonError('Materials, install and overhead actuals are required before marking the review complete', 400);
  }
  const { estimateId } = await ctx.params;
  try {
    const result = await saveEstimateCostActuals(auth.supabase, estimateId, auth.session.user, input);
    if ('error' in result) {
      return result.error === 'not_found'
        ? jsonError('Estimate not found', 404)
        : jsonError('Failed to save actual job costs', 500);
    }
    return jsonOk({ comparison: result.comparison });
  } catch {
    return jsonError('Invalid estimateId', 400);
  }
}
