import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import { validateCostingConfigurationCandidate } from '@/lib/costing/configurationAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const result = validateCostingConfigurationCandidate(parsed.body?.config);
  if (!result.ok) {
    return jsonOk({
      valid: false,
      issues: result.issues,
    }, 422);
  }
  return jsonOk({ valid: true, issues: [] });
}
