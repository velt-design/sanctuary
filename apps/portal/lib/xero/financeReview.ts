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
  observation: financeObservationSchema.nullable().optional(),
})).max(51) });
export type FinanceInvoice = z.infer<typeof financeReviewSchema>['rows'][number];

export function financeOutcome(row: FinanceInvoice, now = Date.now()) {
  const balanceNeedsReview = row.unassignedReceipts || row.recordedCents > row.totalCents || (row.status === 'PAID' && row.recordedCents !== row.totalCents);
  const remainingCents = row.status === 'VOID' || balanceNeedsReview ? null : Math.max(0, row.totalCents - row.recordedCents);
  const observation = row.observation;
  const stale = observation && now - Date.parse(observation.checkedAt) > 24 * 60 * 60 * 1000;
  if (row.correctionRequired && (observation?.state !== 'correction_complete' || stale)) return { remainingCents, attention: true, label: 'Check Xero after portal correction' };
  if (observation?.state === 'conflict') return { remainingCents, attention: true, label: 'Xero differs from the portal — investigate' };
  if (row.unassignedReceipts) return { remainingCents, attention: true, label: 'Assign existing project receipts before chasing payment' };
  if (balanceNeedsReview) return { remainingCents, attention: true, label: 'Check payment history' };
  if (['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '')) return { remainingCents, attention: true,
    label: row.transferError === 'XERO_MAPPING_REQUIRED' ? 'Confirm customer or accounting details' : 'Investigate invoice transfer' };
  if (observation?.state === 'unavailable') return { remainingCents, attention: true, label: 'Xero could not be checked — try again' };
  if (stale) return { remainingCents, attention: true, label: 'Xero check is overdue' };
  if (observation) {
    const labels = { draft: 'Review draft in Xero', awaiting_approval: 'Awaiting approval in Xero', posted: 'Posted in Xero',
      payment_recorded: 'Review Xero payment against portal records', correction_pending: 'Finish correction in Xero', correction_complete: 'Void confirmed in both systems' };
    if (observation.state in labels) return { remainingCents, attention: observation.state === 'correction_pending', label: labels[observation.state as keyof typeof labels] };
  }
  if (row.xeroInvoiceId) return { remainingCents, attention: false, label: 'Xero draft recorded — finance review required' };
  return { remainingCents, attention: false, label: row.captured ? 'Waiting for Xero transfer' : 'Not part of automatic transfer' };
}
