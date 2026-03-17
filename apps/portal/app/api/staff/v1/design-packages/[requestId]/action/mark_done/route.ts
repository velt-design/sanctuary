import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, markDesignRequestDone } from '@/lib/designPackages/server';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  try {
    const { requestId } = await ctx.params;
    const updated = await markDesignRequestDone(requestId);
    const rawId = uuidFromAppId(requestId, 'dpr');

    await automationRunner.runEvent({
      type: 'ticket.design_package_marked_done',
      projectId: updated.projectUuid,
      primaryId: rawId,
      payload: { ticketId: rawId },
    });

    return jsonOk({ ok: true, requestId: updated.requestId });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to complete design request';
    const status = message === 'Design request not found' ? 404 : 409;
    return jsonError(message, status);
  }
}
