import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';
import { updateQuoteInternalNameByVersion } from '@/lib/quotes/internalName.server';
import { getQuoteVersionDetail } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  if (!Object.prototype.hasOwnProperty.call(parsed.body ?? {}, 'internalName')) {
    return jsonError('internalName is required', 400);
  }
  const name = validateCommercialInternalName(parsed.body?.internalName);
  if (!name.ok) return jsonError(name.error, 400);

  try {
    const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;
    await updateQuoteInternalNameByVersion({ quoteVersionId: id, internalName: name.value, actor });
    const quoteVersion = await getQuoteVersionDetail(id);
    if (!quoteVersion) return jsonError('Quote not found', 404);
    return jsonOk({ quoteVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update quote name';
    return jsonError(message, message === 'Quote not found' ? 404 : 500);
  }
}
