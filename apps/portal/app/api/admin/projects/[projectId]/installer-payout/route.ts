import { requireStaffContext } from '@/lib/api/staffApi';
import { jsonError, jsonOk } from '@/lib/api/adminApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { previewPayout } from '@/lib/installerPayouts/preview';
import { buildPayoutEvent, type PayoutEvent } from '@/lib/installerPayouts/model';
type Context = { params: Promise<{ projectId: string }> };
export async function POST(req: Request, ctx: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (auth.session.role !== 'admin') return jsonError('Only admins can confirm installer finances.', 403);
  try {
    const body = await req.json();
    const projectId = uuidFromAppId((await ctx.params).projectId, 'proj');
    if (!body || typeof body !== 'object') return jsonError('Invalid request.');
    if (body.action === 'preview') return jsonOk(await previewPayout(auth.supabase, projectId, body));
    if (!['agreement', 'variation', 'invoice'].includes(body.action)) return jsonError('Invalid action.');
    if (!Number.isSafeInteger(body.expectedSequence) || body.expectedSequence < 0) return jsonError('Reload the payout sheet.');
    const commandId = uuidFromAppId(body.commandId);
    const read = await auth.supabase.rpc('installer_payout_read', { p_project_id: projectId });
    if (read.error) return jsonError('Installer payout storage is unavailable.', 503);
    const events = (read.data ?? []) as PayoutEvent[];
    // Retried requests must use exactly the same intent; the database arbitrates command IDs.
    let payload;
    if (body.action === 'agreement') {
      const preview = await previewPayout(auth.supabase, projectId, body);
      if (preview.fingerprint !== body.fingerprint) return jsonError('The scope or pricebook changed. Review the payout again.', 409);
      payload = preview.agreement;
    } else {
      payload = buildPayoutEvent(body.action, body, events.filter(e => e.id !== commandId));
    }
    const result = await auth.supabase.rpc('installer_payout_append', {
      p_project_id: projectId, p_id: commandId, p_expected_sequence: body.expectedSequence,
      p_kind: body.action, p_payload: payload,
    });
    if (result.error) return jsonError('The payout could not be saved. Reload to check for another update or a duplicate reference.', 409);
    return jsonOk({ saved: true });
  } catch (error) { return jsonError(error instanceof Error ? error.message : 'Unable to save payout.'); }
}
