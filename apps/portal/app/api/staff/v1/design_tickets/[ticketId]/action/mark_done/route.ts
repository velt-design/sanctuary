import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { markDesignRequestOrLegacyTicketDoneByUuid } from '@/lib/designPackages/server';
import { isUuid } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ ticketId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { ticketId } = await ctx.params;
  const raw = String(ticketId ?? '').trim();
  if (!isUuid(raw)) return jsonError('Invalid ticketId', 400);

  let projectUuid: string;
  try {
    const updated = await markDesignRequestOrLegacyTicketDoneByUuid(raw);
    projectUuid = updated.projectUuid;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update design request';
    const status = message === 'Design request not found' ? 404 : 500;
    return jsonError(message, status);
  }

  await automationRunner.runEvent({
    type: 'ticket.design_package_marked_done',
    projectId: projectUuid,
    primaryId: raw,
    payload: { ticketId: raw },
  });

  return jsonOk({ ok: true });
}
