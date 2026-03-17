import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, loadDesignRequestPreview } from '@/lib/designPackages/server';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const estimateId = url.searchParams.get('estimateId')?.trim() ?? '';
  if (!estimateId) return jsonError('estimateId is required', 400);

  try {
    const { projectId } = await ctx.params;
    const preview = await loadDesignRequestPreview(projectId, estimateId);
    return jsonOk({ preview });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to load design request preview';
    const status = message === 'Estimate not found' ? 404 : 500;
    return jsonError(message, status);
  }
}
