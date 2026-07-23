import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import { publishCostingConfigurationDraft } from '@/lib/costing/configurationAdmin';

export const runtime = 'nodejs';

type Context = { params: { versionId: string } | Promise<{ versionId: string }> };

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const { versionId } = await Promise.resolve(params);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  if (typeof parsed.body?.expectedContentHash !== 'string') {
    return jsonError('expectedContentHash is required', 400);
  }
  const expectedCurrentVersionId = parsed.body?.expectedCurrentVersionId;
  if (expectedCurrentVersionId !== null && typeof expectedCurrentVersionId !== 'string') {
    return jsonError('expectedCurrentVersionId must be a version ID or null', 400);
  }
  if (typeof parsed.body?.publishNote !== 'string') {
    return jsonError('publishNote is required', 400);
  }

  try {
    const version = await publishCostingConfigurationDraft(
      auth.supabase,
      versionId,
      parsed.body.expectedContentHash,
      expectedCurrentVersionId,
      parsed.body.publishNote,
    );
    return jsonOk({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish costing configuration';
    const conflict = message.includes('changed') || message.includes('Refresh');
    return jsonError(message, conflict ? 409 : 400);
  }
}
