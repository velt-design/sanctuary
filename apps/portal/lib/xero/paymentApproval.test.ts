import { describe, expect, it } from 'vitest';
import { assertApprovalEvidenceUnchanged, evidenceFingerprint, isPaymentApprover, prepareDepositApproval, readDepositApproval, type DepositEvidence } from './paymentApproval';
import { seal } from './security';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const key = Buffer.alloc(32, 6);
const now = Date.parse('2026-09-14T00:00:00Z');
const evidence: DepositEvidence = { tenantId: id, receiptId: id, contactId: id, projectId: id, invoiceId: id, amountCents: 1, receiptDate: '2026-09-13', invoiceTotalCents: 10000,
  invoiceFingerprint: 'a'.repeat(64), ledgerFingerprint: 'b'.repeat(64), receiptFingerprint: 'c'.repeat(64) };
describe('exact deposit approval envelope', () => {
  it('requires a separate grant and a confirmed identity for every approver', () => {
    expect(isPaymentApprover({ email: 'jordan@sanctuarypergolas.co.nz', email_confirmed_at: 'today' }, true)).toBe(true);
    expect(isPaymentApprover({ email: 'ellen@sanctuarypergolas.co.nz', email_confirmed_at: 'today' }, true)).toBe(true);
    expect(isPaymentApprover({ email: 'info@sanctuarypergolas.co.nz', email_confirmed_at: 'today' })).toBe(false);
    expect(isPaymentApprover({ email: 'jordan@sanctuarypergolas.co.nz' })).toBe(false);
    expect(isPaymentApprover(null)).toBe(false);
  });
  it('preserves exact receipt evidence including a one-cent deposit without exposing it in the envelope', () => {
    const token = prepareDepositApproval(evidence, id, key, now);
    expect(token).not.toContain(evidence.receiptDate);
    expect(readDepositApproval(token, id, id, key, now + 1).evidence).toEqual(evidence);
  });
  it('rejects another actor, tenant, key, an expired envelope and future issuance', () => {
    const token = prepareDepositApproval(evidence, id, key, now);
    for (const read of [() => readDepositApproval(token, other, id, key, now), () => readDepositApproval(token, id, other, key, now),
      () => readDepositApproval(token, id, id, Buffer.alloc(32, 9), now), () => readDepositApproval(token, id, id, key, now + 600000),
      () => readDepositApproval(token, id, id, key, now - 1)]) expect(read).toThrow('APPROVAL_REVIEW_REQUIRED');
  });
  it('rejects tampering and a connection-purpose ciphertext', () => {
    const token = prepareDepositApproval(evidence, id, key, now);
    expect(() => readDepositApproval((token[0] === 'A' ? 'B' : 'A') + token.slice(1), id, id, key, now)).toThrow('APPROVAL_REVIEW_REQUIRED');
    expect(() => readDepositApproval(seal({ purpose: 'sanctuary.deposit-approval.v1', evidence }, key), id, id, key, now)).toThrow('APPROVAL_REVIEW_REQUIRED');
  });
  it.each([{ amountCents: 0 }, { amountCents: 0.5 }, { amountCents: 10001 }, { amountCents: 2147483648 }, { receiptDate: '2026-02-30' }, { receiptId: 'bad' }, { ledgerFingerprint: '' }])('refuses invalid or unreviewable evidence %j', patch => {
    expect(() => prepareDepositApproval({ ...evidence, ...patch }, id, key, now)).toThrow('INVALID_APPROVAL_EVIDENCE');
  });
  it.each([{ amountCents: 2 }, { invoiceId: other }, { projectId: other }, { receiptId: other }, { contactId: other }, { receiptDate: '2026-09-12' },
    { invoiceTotalCents: 9999 }, { ledgerFingerprint: 'd'.repeat(64) }, { receiptFingerprint: 'd'.repeat(64) }, { invoiceFingerprint: 'd'.repeat(64) }])('requires a fresh review for changed evidence %j', patch => {
    const approval = readDepositApproval(prepareDepositApproval(evidence, id, key, now), id, id, key, now);
    expect(() => assertApprovalEvidenceUnchanged(approval, { ...evidence, ...patch })).toThrow('APPROVAL_EVIDENCE_CHANGED');
  });
  it('fingerprints selected snapshots independently of property insertion order', () => {
    expect(evidenceFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(evidenceFingerprint({ a: { c: 3, d: 4 }, b: 2 }));
  });
});
