import 'server-only';

import { insertCommercialAuditEvent } from '../commercial/audit';
import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { supabaseServiceRole } from '../supabaseClient';
import type { ScheduleAllocation, SchedulePaymentEntry, SchedulePlanItem } from './paymentScheduleProjection';

function errorMessage(error: unknown, fallback: string): string {
  return typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message: string }).message)
    : fallback;
}

function requiredReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim().slice(0, 1000) : '';
  if (reason.length < 3) throw new Error('A reason is required');
  return reason;
}

function optionalText(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

export async function loadProjectPaymentLedger(params: {
  projectUuid: string;
  quoteVersionUuid: string;
  invoiceRefsByUuid: Map<string, string>;
}) {
  const [entriesRes, allocationsRes, plansRes] = await Promise.all([
    supabaseServiceRole.from('project_payment_entries').select('*')
      .eq('project_id', params.projectUuid)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabaseServiceRole.from('project_payment_allocations').select('*')
      .eq('project_id', params.projectUuid)
      .is('reversed_at', null),
    supabaseServiceRole.from('project_invoice_plan_items').select('*')
      .eq('quote_version_id', params.quoteVersionUuid)
      .is('cancelled_at', null)
      .order('created_at', { ascending: true })
      .order('position', { ascending: true }),
  ]);
  if (entriesRes.error) throw new Error(errorMessage(entriesRes.error, 'Failed to load job payments'));
  if (allocationsRes.error) throw new Error(errorMessage(allocationsRes.error, 'Failed to load payment allocations'));
  if (plansRes.error) throw new Error(errorMessage(plansRes.error, 'Failed to load invoice plan'));

  const reversalTargets = new Set(
    (entriesRes.data ?? []).map((row: any) => row.reverses_entry_id).filter(Boolean).map(String),
  );
  const entries: SchedulePaymentEntry[] = (entriesRes.data ?? []).map((row: any) => ({
    id: appIdFromUuid('pmt', String(row.id)),
    entryType: String(row.entry_type).toUpperCase() as SchedulePaymentEntry['entryType'],
    amountIncGstCents: Number(row.amount_inc_gst_cents ?? 0) || 0,
    occurredAt: String(row.occurred_at),
    paymentMethod: optionalText(row.payment_method, 80),
    reference: optionalText(row.reference, 240),
    note: optionalText(row.note, 1000),
    reason: optionalText(row.reason, 1000),
    sourceInvoiceId: row.source_invoice_id ? appIdFromUuid('inv', String(row.source_invoice_id)) : null,
    sourceInvoiceRef: row.source_invoice_id ? params.invoiceRefsByUuid.get(String(row.source_invoice_id)) ?? null : null,
    reversed: reversalTargets.has(String(row.id)),
  }));
  const allocations: ScheduleAllocation[] = (allocationsRes.data ?? []).map((row: any) => ({
    id: appIdFromUuid('pma', String(row.id)),
    paymentEntryId: appIdFromUuid('pmt', String(row.payment_entry_id)),
    quoteVersionId: appIdFromUuid('qv', String(row.quote_version_id)),
    paymentTermId: String(row.payment_term_id),
    amountIncGstCents: Number(row.amount_inc_gst_cents ?? 0) || 0,
  }));
  const planItems: SchedulePlanItem[] = (plansRes.data ?? []).map((row: any) => ({
    id: appIdFromUuid('pip', String(row.id)),
    paymentTermId: String(row.payment_term_id),
    label: String(row.label),
    position: Number(row.position),
    itemCount: Number(row.item_count),
    amountIncGstCents: Number(row.amount_inc_gst_cents),
  }));
  return { entries, allocations, planItems };
}

export async function recordProjectPaymentEntry(params: {
  projectId: string;
  entryType: 'PAYMENT' | 'ADJUSTMENT';
  amountIncGstCents: number;
  occurredAt?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  note?: string | null;
  reason?: string | null;
  actor: string | null;
}): Promise<string> {
  const projectUuid = uuidFromAppId(params.projectId, 'proj');
  const amount = Math.trunc(params.amountIncGstCents);
  if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('Payment amount must not be zero');
  if (params.entryType === 'PAYMENT' && amount <= 0) throw new Error('Payment amount must be greater than zero');
  const reason = params.entryType === 'ADJUSTMENT' ? requiredReason(params.reason) : null;
  const occurredAt = params.occurredAt?.trim() || new Date().toISOString();
  if (!Number.isFinite(new Date(occurredAt).getTime())) throw new Error('Payment date is invalid');
  const result = await supabaseServiceRole.rpc('commercial_record_project_payment_entry', {
    p_project_id: projectUuid,
    p_entry_type: params.entryType,
    p_amount_inc_gst_cents: amount,
    p_occurred_at: new Date(occurredAt).toISOString(),
    p_payment_method: optionalText(params.paymentMethod, 80),
    p_reference: optionalText(params.reference, 240),
    p_note: optionalText(params.note, 1000),
    p_reason: reason,
    p_actor: params.actor,
  } as any);
  if (result.error || !result.data) throw new Error(errorMessage(result.error, 'Failed to record payment'));
  await insertCommercialAuditEvent({
    projectId: projectUuid,
    type: params.entryType === 'PAYMENT' ? 'payment.recorded' : 'payment.adjusted',
    idempotencyKey: `project_payment_entry:${String(result.data)}`,
    payload: { paymentEntryId: result.data, amountIncGstCents: amount, reason, actor: params.actor },
  });
  return appIdFromUuid('pmt', String(result.data));
}

export async function replacePaymentAllocations(params: {
  paymentEntryId: string;
  allocations: Array<{ quoteVersionId: string; paymentTermId: string; amountIncGstCents: number }>;
  reason: string;
  actor: string | null;
}): Promise<void> {
  const paymentUuid = uuidFromAppId(params.paymentEntryId, 'pmt');
  const reason = requiredReason(params.reason);
  const paymentRes = await supabaseServiceRole.from('project_payment_entries').select('project_id').eq('id', paymentUuid).single();
  if (paymentRes.error || !paymentRes.data) throw new Error(errorMessage(paymentRes.error, 'Payment entry not found'));
  const allocations = params.allocations.map((allocation) => ({
    quote_version_id: uuidFromAppId(allocation.quoteVersionId, 'qv'),
    payment_term_id: allocation.paymentTermId.trim(),
    amount_inc_gst_cents: Math.trunc(allocation.amountIncGstCents),
  }));
  const rpc = await supabaseServiceRole.rpc('commercial_replace_payment_allocations', {
    p_payment_entry_id: paymentUuid,
    p_allocations: allocations,
    p_reason: reason,
    p_actor: params.actor,
  } as any);
  if (rpc.error) throw new Error(errorMessage(rpc.error, 'Failed to update payment allocations'));
  await insertCommercialAuditEvent({
    projectId: String((paymentRes.data as any).project_id),
    type: 'payment.allocations_replaced',
    payload: { paymentEntryId: paymentUuid, allocations, reason, actor: params.actor },
  });
}

export async function reversePaymentEntry(params: {
  paymentEntryId: string;
  reason: string;
  actor: string | null;
}): Promise<void> {
  const paymentUuid = uuidFromAppId(params.paymentEntryId, 'pmt');
  const reason = requiredReason(params.reason);
  const paymentRes = await supabaseServiceRole.from('project_payment_entries').select('project_id').eq('id', paymentUuid).single();
  if (paymentRes.error || !paymentRes.data) throw new Error(errorMessage(paymentRes.error, 'Payment entry not found'));
  const rpc = await supabaseServiceRole.rpc('commercial_reverse_payment_entry', {
    p_payment_entry_id: paymentUuid,
    p_reason: reason,
    p_actor: params.actor,
  } as any);
  if (rpc.error) throw new Error(errorMessage(rpc.error, 'Failed to reverse payment'));
  await insertCommercialAuditEvent({
    projectId: String((paymentRes.data as any).project_id),
    type: 'payment.reversed',
    idempotencyKey: `project_payment_entry:${String(rpc.data)}`,
    payload: { paymentEntryId: paymentUuid, reversalEntryId: rpc.data, reason, actor: params.actor },
  });
}
