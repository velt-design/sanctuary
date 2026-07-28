import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { QuoteAcceptanceCommandError } from '@/lib/commercial/acceptQuote';
import { markQuoteAccepted } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const result = await markQuoteAccepted(id, actor);
    return jsonOk(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark accepted';
    if (err instanceof QuoteAcceptanceCommandError) {
      return jsonError(
        msg,
        err.code === 'QUOTE_NOT_FOUND' ? 404 : 409,
        null,
        { code: err.code },
      );
    }
    return jsonError(msg, 500);
  }
}
