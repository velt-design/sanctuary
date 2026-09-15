import { createHash, hkdfSync, randomUUID } from 'node:crypto';
import { seal, unseal } from './security';

/** A confirmed portal identity still needs its separate, current database grant. */
export function isPaymentApprover(user: { email?: string; email_confirmed_at?: string } | null, hasGrant = false): boolean {
  return Boolean(user?.email_confirmed_at && user.email && hasGrant);
}

export type DepositEvidence = {
  tenantId: string;
  receiptId: string;
  contactId: string;
  projectId: string;
  invoiceId: string;
  amountCents: number;
  receiptDate: string;
  invoiceTotalCents: number;
  invoiceFingerprint: string;
  ledgerFingerprint: string;
  receiptFingerprint: string;
  invoicePayment?: { providerInvoiceId: string; invoiceEvidenceFingerprint: string };
};
export type DepositApproval = {
  purpose: 'sanctuary.deposit-approval.v1';
  approvalId: string;
  approverId: string;
  issuedAt: number;
  expiresAt: number;
  evidence: DepositEvidence;
};
const lifetime = 10 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fingerprint = /^[a-f0-9]{64}$/;
function approvalKey(rootKey: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', rootKey, 'sanctuary.xero', 'deposit-approval.v1', 32));
}
function validEvidence(value: DepositEvidence): boolean {
  if (!value || typeof value !== 'object') return false;
  const day = typeof value.receiptDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.receiptDate)
    ? new Date(`${value.receiptDate}T00:00:00Z`) : null;
  const source = value.invoicePayment;
  if (source !== undefined && (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).length !== 2 || typeof source.providerInvoiceId !== 'string' || !uuid.test(source.providerInvoiceId)
    || typeof source.invoiceEvidenceFingerprint !== 'string' || !fingerprint.test(source.invoiceEvidenceFingerprint))) return false;
  return [value.tenantId, value.receiptId, value.contactId, value.projectId, value.invoiceId].every(id => typeof id === 'string' && uuid.test(id))
    && Number.isSafeInteger(value.amountCents) && value.amountCents > 0 && value.amountCents <= 2147483647
    && Number.isSafeInteger(value.invoiceTotalCents) && value.invoiceTotalCents >= value.amountCents && value.invoiceTotalCents <= 2147483647
    && Boolean(day && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.receiptDate)
    && [value.invoiceFingerprint, value.ledgerFingerprint, value.receiptFingerprint].every(hash => typeof hash === 'string' && fingerprint.test(hash));
}

/** Deterministic hashing for explicitly selected snapshots; never hash full provider payloads. */
export function evidenceFingerprint(value: unknown): string {
  function stable(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(stable);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
    return item;
  }
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function prepareDepositApproval(evidence: DepositEvidence, approverId: string, key: Buffer, now = Date.now()): string {
  if (!uuid.test(approverId) || !validEvidence(evidence) || !Number.isSafeInteger(now)) throw new Error('INVALID_APPROVAL_EVIDENCE');
  return seal({ purpose: 'sanctuary.deposit-approval.v1', approvalId: randomUUID(), approverId, issuedAt: now, expiresAt: now + lifetime, evidence } satisfies DepositApproval, approvalKey(key));
}

/** Opening an envelope is not authorisation: the route must recheck capability and live evidence. */
export function readDepositApproval(token: string, approverId: string, tenantId: string, key: Buffer, now = Date.now()): DepositApproval {
  try {
    if (typeof token !== 'string' || token.length > 10000) throw new Error();
    const value = unseal<DepositApproval>(token, approvalKey(key));
    if (value?.purpose !== 'sanctuary.deposit-approval.v1' || !uuid.test(value.approvalId) || value.approverId !== approverId
      || !validEvidence(value.evidence) || value.evidence.tenantId !== tenantId
      || !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)
      || value.expiresAt - value.issuedAt !== lifetime || value.issuedAt > now || value.expiresAt <= now) throw new Error();
    return value;
  } catch { throw new Error('APPROVAL_REVIEW_REQUIRED'); }
}

export function assertApprovalEvidenceUnchanged(approval: DepositApproval, current: DepositEvidence): void {
  if (!validEvidence(current) || evidenceFingerprint(approval.evidence) !== evidenceFingerprint(current)) throw new Error('APPROVAL_EVIDENCE_CHANGED');
}
