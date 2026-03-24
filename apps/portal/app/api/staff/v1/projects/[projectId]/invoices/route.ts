import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { listDepositInvoicesForProject } from '@/lib/invoices/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  try {
    const invoices = await listDepositInvoicesForProject(projectIdRaw);
    return jsonOk({ invoices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invoices';
    return jsonError(message, 500);
  }
}

