import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import {
  getCostingConfigurationEditor,
  getCostingConfigurationEditorCatalog,
  saveCostingConfigurationDraft,
} from '@/lib/costing/configurationAdmin';

export const runtime = 'nodejs';

type Context = { params: Promise<{ versionId: string }> };

function validationIssues(error: unknown): unknown[] | null {
  const issues = (error as { validationIssues?: unknown })?.validationIssues;
  return Array.isArray(issues) ? issues : null;
}

export async function GET(_req: Request, { params }: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const { versionId } = await params;

  try {
    const editor = await getCostingConfigurationEditor(auth.supabase, versionId);
    return jsonOk({ ...editor, catalog: getCostingConfigurationEditorCatalog() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to load costing configuration', 404);
  }
}

export async function PUT(req: Request, { params }: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const { versionId } = await params;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body?.expectedContentHash !== 'string') {
    return jsonError('expectedContentHash is required', 400);
  }

  try {
    const version = await saveCostingConfigurationDraft(
      auth.supabase,
      {
        id: auth.session.user.id,
        email: auth.session.user.email ?? '',
      },
      versionId,
      parsed.body.expectedContentHash,
      parsed.body.config,
    );
    const editor = await getCostingConfigurationEditor(auth.supabase, version.id);
    return jsonOk({ ...editor, catalog: getCostingConfigurationEditorCatalog() });
  } catch (error) {
    const issues = validationIssues(error);
    if (issues) return jsonOk({ error: 'Validation failed', issues }, 422);
    const message = error instanceof Error ? error.message : 'Failed to save costing configuration';
    return jsonError(message, message.includes('changed or was published') ? 409 : 400);
  }
}
