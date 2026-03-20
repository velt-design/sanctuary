import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { generateJobPackForQuoteVersion, isMissingSchemaError } from '@/lib/jobPacks/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const quoteVersionId = typeof body.quoteVersionId === 'string' ? body.quoteVersionId.trim() : '';
  if (!projectId) return jsonError('projectId is required', 400);
  if (!quoteVersionId) return jsonError('quoteVersionId is required', 400);

  try {
    const jobPack = await generateJobPackForQuoteVersion({
      projectId,
      quoteVersionId,
      actor: typeof session.user?.email === 'string' ? session.user.email.trim() : null,
    });
    return jsonOk({ jobPack }, 201);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Job pack schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to generate job pack';
    const lower = message.toLowerCase();
    const status =
      lower.includes('sent') || lower.includes('belongs to this project')
        ? 409
        : message === 'Quote not found'
          ? 404
          : 500;
    return jsonError(message, status);
  }
}
