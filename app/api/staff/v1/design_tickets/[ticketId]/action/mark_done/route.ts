import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { isUuid } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ ticketId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { ticketId } = await ctx.params;
  const raw = String(ticketId ?? '').trim();
  if (!isUuid(raw)) return jsonError('Invalid ticketId', 400);

  const ticketRes = await supabaseServer.from('design_package_tickets').select('id, project_id').eq('id', raw).single();
  if (ticketRes.error || !ticketRes.data) return jsonError('Design ticket not found', 404);

  const updateRes = await supabaseServer
    .from('design_package_tickets')
    .update({ status: 'DONE', completed_at: new Date().toISOString() } as any)
    .eq('id', raw);
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update design ticket', 500);

  await automationRunner.runEvent({
    type: 'ticket.design_package_marked_done',
    projectId: ticketRes.data.project_id,
    primaryId: raw,
    payload: { ticketId: raw },
  });

  return jsonOk({ ok: true });
}

