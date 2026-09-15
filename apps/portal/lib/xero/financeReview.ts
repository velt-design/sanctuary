import { z } from 'zod';
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const financeObservationSchema = z.object({ invoiceId: z.string().uuid(),
  state: z.enum(['draft', 'awaiting_approval', 'posted', 'payment_recorded', 'conflict', 'correction_pending', 'correction_complete', 'unavailable']),
  reason: z.string(), amountPaidCents: cents.nullable(), checkedAt: z.string().datetime({ offset: true }),
});
export const financeReviewSchema = z.object({ checkedAt: z.string(), rows: z.array(z.object({
  invoiceId: z.string().uuid(), invoiceRef: z.string(), projectId: z.string().uuid(),
  customerName: z.string(), projectName: z.string(), status: z.enum(['OPEN', 'PAID', 'VOID']),
  currency: z.string().regex(/^[A-Z]{3}$/), dueDate: z.string().nullable(), totalCents: cents, recordedCents: cents,
  xeroInvoiceId: z.string().uuid().nullable(), lastVerifiedAt: z.string().nullable(),
  transferStatus: z.string().nullable(), transferError: z.string().nullable(), captured: z.boolean(), correctionRequired: z.boolean(),
  unassignedReceipts: z.boolean(),
  observation: financeObservationSchema.nullable(),
  transferTargetStatus: z.enum(['DRAFT', 'AUTHORISED']).nullable().optional(),
  paymentSync: z.object({ state: z.enum(['current','recorded','review','unavailable']), reason: z.string(), checkedAt: z.string() }).nullable().optional(),
})).max(51) });
export type FinanceInvoice = z.infer<typeof financeReviewSchema>['rows'][number];
export type FinanceView = 'attention' | 'current' | 'history';
export function parseFinanceView(value: unknown): FinanceView {
  return value === 'current' || value === 'history' ? value : 'attention';
}

export function financeOutcome(row: FinanceInvoice, now = Date.now()) {
  const balanceNeedsReview = row.unassignedReceipts || row.recordedCents > row.totalCents || (row.status === 'PAID' && row.recordedCents !== row.totalCents)
    || (row.status === 'OPEN' && row.recordedCents === row.totalCents);
  const remainingCents = row.status === 'VOID' || balanceNeedsReview ? null : Math.max(0, row.totalCents - row.recordedCents);
  const observation = row.observation;
  const stale = observation && now - Date.parse(observation.checkedAt) > 24 * 60 * 60 * 1000;
  if (row.status === 'VOID' && row.recordedCents > 0) return { remainingCents, attention: true, label: 'Voided invoice still has payments — review their ownership' };
  if (row.correctionRequired && (observation?.state !== 'correction_complete' || stale)) return { remainingCents, attention: true, label: 'Check Xero after portal correction' };
  if (row.correctionRequired && observation?.state === 'correction_complete') return { remainingCents, attention: false, label: 'Void confirmed in both systems' };
  if (row.status === 'VOID') return { remainingCents, attention: false, label: 'Voided in portal' };
  if (observation?.state === 'conflict') return { remainingCents, attention: true, label: 'Xero differs from the portal — investigate' };
  if (row.unassignedReceipts) return { remainingCents, attention: true, label: 'Assign existing project receipts before chasing payment' };
  if (balanceNeedsReview) return { remainingCents, attention: true, label: 'Check payment history' };
  if (row.paymentSync?.state === 'review') return { remainingCents, attention: true, label: 'Payment needs a finance check' };
  if (row.paymentSync?.state === 'unavailable') return { remainingCents, attention: true, label: 'Automatic payment update could not finish' };
  if (row.paymentSync && now - Date.parse(row.paymentSync.checkedAt) > 24 * 60 * 60 * 1000)
    return { remainingCents, attention: true, label: 'Automatic payment check is overdue' };
  if (['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '')) return { remainingCents, attention: true,
    label: row.transferError === 'XERO_MAPPING_REQUIRED' ? 'Confirm customer or accounting details' : 'Investigate invoice transfer' };
  if (observation?.state === 'unavailable') return { remainingCents, attention: true, label: 'Xero could not be checked — try again' };
  if (stale) return { remainingCents, attention: true, label: 'Xero check is overdue' };
  if (observation && observation.amountPaidCents !== null && observation.amountPaidCents < row.recordedCents)
    return { remainingCents, attention: true, label: 'Portal payments exceed Xero — investigate' };
  if (observation?.state === 'payment_recorded') {
    if (observation.amountPaidCents !== row.recordedCents) return { remainingCents, attention: true, label: 'Review Xero payment against portal records' };
    return { remainingCents, attention: false, label: row.status === 'PAID' ? 'Paid — portal and Xero agree' : 'Payments agree — balance outstanding' };
  }
  if (observation) {
    const labels = { draft: 'Review draft in Xero', awaiting_approval: 'Awaiting approval in Xero', posted: 'Posted in Xero',
      payment_recorded: 'Review Xero payment against portal records', correction_pending: 'Finish correction in Xero', correction_complete: 'Void confirmed in both systems' };
    if (observation.state in labels) return { remainingCents, attention: ['draft', 'awaiting_approval', 'correction_pending'].includes(observation.state), label: labels[observation.state as keyof typeof labels] };
  }
  if (row.status === 'PAID') return { remainingCents, attention: Boolean(row.xeroInvoiceId), label: row.xeroInvoiceId ? 'Portal paid — verify Xero' : 'Recorded paid in portal' };
  if (row.xeroInvoiceId) return { remainingCents, attention: true, label: row.transferTargetStatus === 'AUTHORISED' ? 'Invoice created in Xero — waiting for its next check' : 'Xero draft recorded — finance review required' };
  return { remainingCents, attention: false, label: row.captured ? 'Waiting for Xero transfer' : 'Not part of automatic transfer' };
}
