import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffSession,
} from '@/lib/api/staffApi';
import { reviseQuoteVersion } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const clientIntentId =
    typeof parsed.body?.clientIntentId === 'string'
      ? parsed.body.clientIntentId.trim()
      : '';
  if (
    clientIntentId.length < 8 ||
    clientIntentId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(clientIntentId)
  ) {
    return jsonError('clientIntentId is required', 400);
  }

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const quoteVersion = await reviseQuoteVersion(id, actor, clientIntentId);
    return jsonOk({ quoteVersion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to revise quote';
    return jsonError(msg, 500);
  }
}
