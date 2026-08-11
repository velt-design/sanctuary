import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isQuoteHandoffBlockedError } from '@/lib/quotes/mapping';
import { createQuoteFromEstimate, listQuoteVersionsForProject } from '@/lib/quotes/server';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  try {
    const quotes = await listQuoteVersionsForProject(projectIdRaw);
    return jsonOk({ quotes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load quotes';
    return jsonError(msg, 500);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const internalName = validateCommercialInternalName(body.internalName);
  if (!internalName.ok) return jsonError(internalName.error, 400);
  const estimateVersionId = typeof body.estimateVersionId === 'string' ? body.estimateVersionId.trim() : '';
  if (!estimateVersionId) return jsonError('estimateVersionId is required', 400);
  const clientIntentId =
    typeof body.clientIntentId === 'string' ? body.clientIntentId.trim() : '';
  if (
    clientIntentId.length < 8 ||
    clientIntentId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(clientIntentId)
  ) {
    return jsonError('clientIntentId is required', 400);
  }

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const quoteVersion = internalName.value
      ? await createQuoteFromEstimate(projectIdRaw, estimateVersionId, actor, clientIntentId, internalName.value)
      : await createQuoteFromEstimate(projectIdRaw, estimateVersionId, actor, clientIntentId);
    return jsonOk({ quoteVersion }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create quote';
    if (isQuoteHandoffBlockedError(err)) return jsonError(msg, 422);
    return jsonError(msg, 500);
  }
}
