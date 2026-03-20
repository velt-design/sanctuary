import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, listGeneratedJobPacksForProject } from '@/lib/jobPacks/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  try {
    const jobPacks = await listGeneratedJobPacksForProject(projectIdRaw);
    return jsonOk({ jobPacks });
  } catch (error) {
    if (isMissingSchemaError(error)) return jsonOk({ jobPacks: [] });
    const message = error instanceof Error ? error.message : 'Failed to load job packs';
    return jsonError(message, 500);
  }
}
