import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  normalizeMarketingConversionOccurredAt,
  recentMarketingConversionOccurrence,
  recordMarketingConversionEvent,
} from '@/lib/marketingAttribution/server';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

function normalizePaidDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  let paidDate = normalizePaidDate(parsed.body?.paidDate);
  if (!paidDate) return jsonError('paidDate must be a valid date in YYYY-MM-DD format', 400);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const command = await supabase.rpc('commercial_mark_project_deposit_received', {
    p_project_id: projectUuid,
    p_expected_paid_date: paidDate,
  });
  if (command.error) {
    const message = command.error.message ?? 'Failed to verify deposit payment';
    return jsonError(message, /Mark the whole|unavailable|match|Invalid stage/.test(message) ? 409 : 500);
  }
  const commandRow = Array.isArray(command.data) ? command.data[0] : command.data;
  const replayed = (commandRow as any)?.changed !== true;
  const fromStage = String((commandRow as any)?.previous_stage ?? '').toUpperCase();
  const ledgerPaidDate = typeof (commandRow as any)?.paid_date === 'string'
    ? String((commandRow as any).paid_date)
    : null;
  if (!ledgerPaidDate) return jsonError('The deposit payment date is unavailable', 409);
  paidDate = ledgerPaidDate;
  const quoteVersionId = String((commandRow as any)?.quote_version_id ?? '');
  const quoteValueIncGstCents = Number((commandRow as any)?.quote_total_inc_gst_cents);
  const depositInvoiceId = String((commandRow as any)?.invoice_id ?? '');
  const occurredAt = normalizeMarketingConversionOccurredAt((commandRow as any)?.occurred_at);
  if (!occurredAt && !replayed) {
    return jsonError('Deposit was recorded but its occurrence time is unavailable', 500);
  }

  const shouldRepairSideEffects =
    occurredAt !== null
    && (!replayed || Boolean(recentMarketingConversionOccurrence(occurredAt)));

  if (!shouldRepairSideEffects) {
    return jsonOk({ ok: true, paidDate, replayed });
  }

  // The database-owned deposit_received_at value owns the occurrence time.
  // Record its idempotent conversion before best-effort automation follow-ups.
  await recordMarketingConversionEvent({
    type: 'marketing.deposit_received',
    projectId: projectUuid,
    occurredAt,
    payload: {
      paidDate,
      depositInvoiceId,
      quoteVersionId,
      ...(Number.isSafeInteger(quoteValueIncGstCents)
        && quoteValueIncGstCents > 0
        ? { valueIncGstCents: quoteValueIncGstCents }
        : {}),
    },
  });

  try {
    await automationRunner.runEvent({
      type: 'pipeline.stage_changed',
      projectId: projectUuid,
      stage: 'DEPOSIT',
      payload: { fromStage, toStage: 'DEPOSIT' },
    });

    await automationRunner.runEvent({
      type: 'ui.action.mark_deposit_received',
      projectId: projectUuid,
      stage: 'DEPOSIT',
      payload: {
        paidDate,
        depositInvoiceId,
        quoteVersionId,
      },
    });
  } catch (error) {
    // The commercial truth is already committed and the idempotent conversion
    // owner above has run. A recent replay can repair remaining automation.
    console.error('[mark_deposit_received] automation follow-up failed', error);
  }

  return jsonOk({ ok: true, paidDate, replayed });
}

