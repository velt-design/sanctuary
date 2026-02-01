import { requireAdminSession, jsonError, jsonOk } from '@/lib/api/adminApi';
import { fetchCostingOverrides } from '@/lib/costing/overrides';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const overrides = await fetchCostingOverrides();
    return jsonOk(overrides);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load overrides';
    return jsonError(message, 500);
  }
}
