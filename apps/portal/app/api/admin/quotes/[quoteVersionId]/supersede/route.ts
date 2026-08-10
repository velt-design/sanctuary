import { jsonError, jsonOk, requireAdminSession } from '@/lib/api/adminApi';
import { markQuoteVersionSuperseded } from '@/lib/quotes/adminLifecycle';
import { getQuoteVersionDetail } from '@/lib/quotes/server';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { quoteVersionId } = await context.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  try {
    await markQuoteVersionSuperseded(id, auth.session.user.id);
    const quoteVersion = await getQuoteVersionDetail(id);
    if (!quoteVersion) return jsonError('Quote not found', 404);
    return jsonOk({ quoteVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark quote superseded';
    const status = /not found/i.test(message) ? 404 : /only sent or accepted|changed before/i.test(message) ? 409 : 500;
    return jsonError(message, status);
  }
}
