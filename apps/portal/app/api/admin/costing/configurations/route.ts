import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import {
  createCostingConfigurationDraft,
  listCostingConfigurationOverview,
} from '@/lib/costing/configurationAdmin';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  try {
    const overview = await listCostingConfigurationOverview(auth.supabase);
    return jsonOk(overview);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to load costing configurations', 500);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const sourceVersionId = typeof parsed.body?.sourceVersionId === 'string'
    ? parsed.body.sourceVersionId.trim()
    : null;
  try {
    const version = await createCostingConfigurationDraft(
      auth.supabase,
      {
        id: auth.session.user.id,
        email: auth.session.user.email ?? '',
      },
      sourceVersionId,
    );
    return jsonOk({ version }, 201);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to create costing draft', 400);
  }
}
