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
  const paidDate = normalizePaidDate(parsed.body?.paidDate);
  if (!paidDate) return jsonError('paidDate must be a valid date in YYYY-MM-DD format', 400);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prev = await supabase
    .from('projects')
    .select('id, pipeline_stage, deposit_paid_date, deposit_received_at')
    .eq('id', projectUuid)
    .single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (fromStage !== 'SENT' && fromStage !== 'DEPOSIT') {
    return jsonError('Invalid stage transition (expected SENT)', 409);
  }

  const openInvoiceRes = await supabase
    .from('deposit_invoices')
    .select('id, quote_version_id, quote_total_inc_gst_cents, created_at')
    .eq('project_id', projectUuid)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openInvoiceRes.error) {
    return jsonError(openInvoiceRes.error.message ?? 'Failed to load deposit invoice', 500);
  }
  if (!openInvoiceRes.data) return jsonError('No open deposit invoice found', 409);

  const quoteVersionId =
    typeof openInvoiceRes.data.quote_version_id === 'string'
      ? openInvoiceRes.data.quote_version_id
      : '';
  if (!quoteVersionId) return jsonError('Deposit invoice is not linked to a quote version', 409);
  const quoteValueIncGstCents = Number(
    openInvoiceRes.data.quote_total_inc_gst_cents,
  );

  const quoteRes = await supabase
    .from('quote_versions')
    .select('id, status, accepted_at')
    .eq('id', quoteVersionId)
    .maybeSingle();
  if (quoteRes.error) {
    return jsonError(quoteRes.error.message ?? 'Failed to load accepted quote', 500);
  }
  if (!quoteRes.data || String(quoteRes.data.status ?? '').toUpperCase() !== 'ACCEPTED') {
    return jsonError('The deposit invoice quote has not been accepted', 409);
  }

  let occurredAt: string | null = null;
  let replayed = false;
  if (fromStage === 'SENT') {
    const observedStage = String(prev.data.pipeline_stage ?? '');
    const updateRes = await supabase
      .from('projects')
      .update({
        pipeline_stage: 'DEPOSIT',
        deposit_paid_date: paidDate,
      } as any)
      .eq('id', projectUuid)
      .eq('pipeline_stage', observedStage)
      .select('id, pipeline_stage, deposit_paid_date, deposit_received_at')
      .maybeSingle();
    if (updateRes.error) {
      return jsonError(updateRes.error.message ?? 'Failed to update project', 500);
    }
    if (!updateRes.data) {
      return jsonError('Project changed before the deposit could be recorded', 409);
    }
    occurredAt = normalizeMarketingConversionOccurredAt(
      updateRes.data.deposit_received_at,
    );
    if (!occurredAt) {
      return jsonError('Deposit was recorded but its occurrence time is unavailable', 500);
    }
  } else {
    replayed = true;
    const existingPaidDate =
      typeof prev.data.deposit_paid_date === 'string'
        ? prev.data.deposit_paid_date
        : '';
    if (existingPaidDate !== paidDate) {
      return jsonError(
        existingPaidDate
          ? `Deposit was already recorded on ${existingPaidDate}`
          : 'Deposit stage is missing its received date',
        409,
      );
    }
    occurredAt = normalizeMarketingConversionOccurredAt(
      prev.data.deposit_received_at,
    );
  }

  const shouldRepairSideEffects =
    occurredAt !== null
    && (!replayed || Boolean(recentMarketingConversionOccurrence(occurredAt)));

  if (!shouldRepairSideEffects) {
    return jsonOk({ ok: true, paidDate, replayed: true });
  }

  // The database-owned deposit_received_at value owns the occurrence time.
  // Record its idempotent conversion before best-effort automation follow-ups.
  await recordMarketingConversionEvent({
    type: 'marketing.deposit_received',
    projectId: projectUuid,
    occurredAt,
    payload: {
      paidDate,
      depositInvoiceId: String(openInvoiceRes.data.id ?? ''),
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
      payload: { fromStage: 'SENT', toStage: 'DEPOSIT' },
    });

    await automationRunner.runEvent({
      type: 'ui.action.mark_deposit_received',
      projectId: projectUuid,
      stage: 'DEPOSIT',
      payload: {
        paidDate,
        depositInvoiceId: String(openInvoiceRes.data.id ?? ''),
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

