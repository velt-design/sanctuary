import { jsonError, jsonOk, requireAdminContext } from '@/lib/api/adminApi';
import { listCostingEstimateCandidates } from '@/lib/costing/configurationEstimatePreview';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const query = new URL(req.url).searchParams.get('q')?.slice(0, 120) ?? '';
  try {
    const response = jsonOk({ estimates: await listCostingEstimateCandidates(auth.supabase, query) });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to load estimate previews', 500);
  }
}
