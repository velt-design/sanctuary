import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createQuoteFromEstimate, listQuoteVersionsForProject } from '@/lib/quotes/server';

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
  const estimateVersionId = typeof body.estimateVersionId === 'string' ? body.estimateVersionId.trim() : '';
  if (!estimateVersionId) return jsonError('estimateVersionId is required', 400);

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const quoteVersion = await createQuoteFromEstimate(projectIdRaw, estimateVersionId, actor);
    return jsonOk({ quoteVersion }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create quote';
    return jsonError(msg, 500);
  }
}
