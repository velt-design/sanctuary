import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { markQuoteDeclined } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  try {
    const quoteVersion = await markQuoteDeclined(id);
    return jsonOk({ quoteVersion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark declined';
    return jsonError(msg, 500);
  }
}
