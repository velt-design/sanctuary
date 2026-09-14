import { expect, it } from 'vitest';
import { financeOutcome, type FinanceInvoice } from './financeReview';
const now = Date.parse('2026-09-14T10:00:00Z');
const row: FinanceInvoice = { invoiceId: 'id', invoiceRef: 'INV-TEST', projectId: 'project', customerName: 'Example', projectName: 'Example',
  status: 'OPEN', currency: 'NZD', dueDate: null, totalCents: 100, recordedCents: 0, xeroInvoiceId: 'bound', lastVerifiedAt: null,
  transferStatus: 'succeeded', transferError: null, captured: true, correctionRequired: false, unassignedReceipts: false,
  observation: { invoiceId: 'id', state: 'posted', reason: 'INVOICE_CONTENT_UNCHANGED', amountPaidCents: 0, checkedAt: '2026-09-14T09:00:00Z' } };
it('shows normal posting without labeling it a draft or recording a portal payment', () => {
  expect(financeOutcome(row, now)).toEqual({ remainingCents: 100, attention: false, label: 'Posted in Xero' });
});
it('flags stale checks and unavailable reads', () => {
  expect(financeOutcome({ ...row, observation: { ...row.observation!, checkedAt: '2026-09-12T09:00:00Z' } }, now).label).toBe('Xero check is overdue');
  expect(financeOutcome({ ...row, observation: { ...row.observation!, state: 'unavailable' } }, now).label).toContain('could not be checked');
});
it('keeps a portal correction open until both systems are verified voided', () => {
  const voided = { ...row, status: 'VOID' as const, correctionRequired: true };
  expect(financeOutcome(voided, now).attention).toBe(true);
  expect(financeOutcome({ ...voided, unassignedReceipts: true, observation: { ...row.observation!, state: 'correction_complete' } }, now)).toMatchObject({ attention: false, label: 'Void confirmed in both systems' });
});
it('does not turn Xero paid evidence into a portal balance change', () => {
  expect(financeOutcome({ ...row, observation: { ...row.observation!, state: 'payment_recorded', amountPaidCents: 100 } }, now)).toMatchObject({ remainingCents: 100, label: 'Review Xero payment against portal records' });
});
