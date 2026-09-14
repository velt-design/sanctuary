import { z } from 'zod';
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const financeReviewSchema = z.object({ checkedAt: z.string(), rows: z.array(z.object({
  invoiceId: z.string().uuid(), invoiceRef: z.string(), projectId: z.string().uuid(),
  customerName: z.string(), projectName: z.string(), status: z.enum(['OPEN', 'PAID', 'VOID']),
  currency: z.string().regex(/^[A-Z]{3}$/), dueDate: z.string().nullable(), totalCents: cents, recordedCents: cents,
  xeroInvoiceId: z.string().uuid().nullable(), lastVerifiedAt: z.string().nullable(),
  transferStatus: z.string().nullable(), transferError: z.string().nullable(), captured: z.boolean(), correctionRequired: z.boolean(),
  unassignedReceipts: z.boolean(),
})).max(51) });
export type FinanceInvoice = z.infer<typeof financeReviewSchema>['rows'][number];

export function financeOutcome(row: FinanceInvoice) {
  const balanceNeedsReview = row.unassignedReceipts || row.recordedCents > row.totalCents || (row.status === 'PAID' && row.recordedCents !== row.totalCents);
  const remainingCents = row.status === 'VOID' || balanceNeedsReview ? null : Math.max(0, row.totalCents - row.recordedCents);
  if (row.correctionRequired) return { remainingCents, attention: true, label: 'Check Xero after portal correction' };
  if (row.unassignedReceipts) return { remainingCents, attention: true, label: 'Assign existing project receipts before chasing payment' };
  if (balanceNeedsReview) return { remainingCents, attention: true, label: 'Check payment history' };
  if (['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '')) return { remainingCents, attention: true,
    label: row.transferError === 'XERO_MAPPING_REQUIRED' ? 'Confirm customer or accounting details' : 'Investigate invoice transfer' };
  if (row.xeroInvoiceId) return { remainingCents, attention: false, label: 'Xero draft recorded — finance review required' };
  return { remainingCents, attention: false, label: row.captured ? 'Waiting for Xero transfer' : 'Not part of automatic transfer' };
}
