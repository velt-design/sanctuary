import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import { previewCostingDraftAgainstEstimate } from '@/lib/costing/configurationEstimatePreview';

export const runtime = 'nodejs';

type Context = { params: Promise<{ versionId: string }> };

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { versionId } = await params;
  const estimateId = typeof parsed.body?.estimateId === 'string' ? parsed.body.estimateId.trim() : '';
  const expectedContentHash = typeof parsed.body?.expectedContentHash === 'string'
    ? parsed.body.expectedContentHash.trim()
    : '';
  if (!estimateId || !expectedContentHash) {
    return jsonError('estimateId and expectedContentHash are required', 400);
  }
  try {
    const response = jsonOk({
      preview: await previewCostingDraftAgainstEstimate(
        auth.supabase,
        versionId,
        estimateId,
        expectedContentHash,
      ),
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview this estimate';
    return jsonError(message, message.includes('changed') ? 409 : 400);
  }
}
