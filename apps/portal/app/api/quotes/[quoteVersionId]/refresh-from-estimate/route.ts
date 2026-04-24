import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { previewDraftQuoteRefreshFromEstimate, refreshDraftQuoteVersionFromEstimate } from '@/lib/quotes/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function quoteLockedResponse(message = 'Quote is locked') {
  return NextResponse.json({ error: message, code: 'QUOTE_LOCKED' }, { status: 423 });
}

function quoteErrorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  if (message === 'Quote not found') return jsonError(message, 404);
  if (message === 'Estimate not found') return jsonError(message, 404);
  if (message === 'Quote is locked') return quoteLockedResponse(message);
  return jsonError(message, 500);
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const estimateVersionId = typeof body.estimateVersionId === 'string' ? body.estimateVersionId.trim() : '';
  if (!estimateVersionId) return jsonError('estimateVersionId is required', 400);
  const mode =
    body.mode === 'pricing_only' || body.mode === 'generated_content' || body.mode === 'full_rebuild'
      ? body.mode
      : 'full_rebuild';
  const dryRun = body.dryRun === true;

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    if (dryRun) {
      const preview = await previewDraftQuoteRefreshFromEstimate(id, estimateVersionId, mode);
      return jsonOk({ preview });
    }
    const quoteVersion = await refreshDraftQuoteVersionFromEstimate(id, estimateVersionId, actor, mode);
    return jsonOk({ quoteVersion });
  } catch (err) {
    return quoteErrorResponse(err, 'Failed to refresh quote from design');
  }
}
