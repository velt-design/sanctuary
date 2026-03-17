import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, updateDesignRequestDesignerNote } from '@/lib/designPackages/server';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};
  const designerNote =
    typeof body.designerNote === 'string' ? body.designerNote : body.designerNote === null ? null : undefined;

  if (typeof designerNote === 'undefined') return jsonError('designerNote is required', 400);

  try {
    const { requestId } = await ctx.params;
    const updated = await updateDesignRequestDesignerNote(requestId, designerNote);
    return jsonOk({ ok: true, requestId: updated.requestId });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to update design request';
    const status = message === 'Design request not found' ? 404 : 500;
    return jsonError(message, status);
  }
}
