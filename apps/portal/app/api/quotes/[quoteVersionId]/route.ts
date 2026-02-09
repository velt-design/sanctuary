import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { deleteDraftQuoteVersion, getQuoteVersionDetail, updateDraftQuoteVersion } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const detail = await getQuoteVersionDetail(id);
  if (!detail) return jsonError('Quote not found', 404);
  return jsonOk({ quoteVersion: detail });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};

  try {
    const updated = await updateDraftQuoteVersion(id, {
      reference: typeof body.reference === 'string' ? body.reference : body.reference === null ? null : undefined,
      introText: typeof body.introText === 'string' ? body.introText : body.introText === null ? null : undefined,
      termsText: typeof body.termsText === 'string' ? body.termsText : body.termsText === null ? null : undefined,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : body.expiresAt === null ? null : undefined,
      lineItems: Array.isArray(body.lineItems) ? body.lineItems : undefined,
    });
    return jsonOk({ quoteVersion: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update quote';
    return jsonError(msg, 500);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  try {
    await deleteDraftQuoteVersion(id);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete quote';
    return jsonError(msg, 500);
  }
}
