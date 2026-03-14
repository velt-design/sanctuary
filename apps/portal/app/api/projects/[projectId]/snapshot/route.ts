import { NextResponse } from 'next/server';
import { jsonError, requireStaffSession } from '@/lib/api/staffApi';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const startedAt = performance.now();
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { projectId } = await ctx.params;
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return jsonError('Invalid projectId', 400);

  try {
    const snapshot = await getProjectPageSnapshot(id);
    if (!snapshot) return jsonError('Project not found', 404);

    const response = NextResponse.json({
      snapshot,
      generatedAt: new Date().toISOString(),
    });
    response.headers.set('server-timing', `total;dur=${(performance.now() - startedAt).toFixed(1)}`);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load project snapshot';
    return jsonError(msg, 500);
  }
}
