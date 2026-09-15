import { describe, expect, it } from 'vitest';
import { getBackgroundJobAutomaticRetryDecision, getBackgroundJobDefinition, parseXeroInvoiceJobPayloadV1 } from './index';

const payload = { contractVersion: 1, transferId: '11111111-1111-4111-8111-111111111111',
  invoiceId: '22222222-2222-4222-8222-222222222222', tenantId: '33333333-3333-4333-8333-333333333333' };

describe('Xero draft job contract', () => {
  it('accepts bounded identity and rejects added credentials or requested amounts', () => {
    expect(parseXeroInvoiceJobPayloadV1(payload)).toEqual(payload);
    for (const value of [{ ...payload, accessToken: 'secret' }, { ...payload, total: 1 },
      { ...payload, tenantId: 'customer name' }, { ...payload, contractVersion: 2 }]) {
      expect(() => parseXeroInvoiceJobPayloadV1(value)).toThrow();
    }
  });
  it('defaults dark and limits retries to less than the provider six-minute window', () => {
    const definition = getBackgroundJobDefinition('xero_invoice_draft_v1');
    expect(definition.defaultRolloutMode).toBe('disabled');
    expect(definition.retry.automaticRetryWindowMs).toBe(300000);
    const now = Date.parse('2026-09-14T10:00:00Z');
    const decision = getBackgroundJobAutomaticRetryDecision({ kind: 'xero_invoice_draft_v1', contractVersion: 1,
      attemptNumber: 1, elapsedSinceFirstAttemptMs: 0, nowMs: now, executionOwner: 'worker',
      effects: [{ effectKind: 'xero_invoice_draft', state: 'uncertain', providerIdempotencyExpiresAt: new Date(now - 1).toISOString() }] });
    expect(decision.retry).toBe(false);
  });
});
