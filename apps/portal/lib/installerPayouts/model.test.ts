import { describe, expect, it } from 'vitest';
import { buildPayoutEvent, money, payoutSummary, type PayoutEvent } from './model';
const agreement = { id: 'a', sequence: 1, kind: 'agreement', created_at: '', created_by: '', payload: { ...money(1886.96, true), gstRegistered: true } } as PayoutEvent;
describe('installer payout workflow', () => {
  it('keeps the GST-inclusive old formula separate from invoice totals', () => {
    expect(money(1886.96, true)).toEqual({ payoutExGst: 1886.96, gst: 283.04, totalPayable: 2170 });
    expect(money(1886.96, false).totalPayable).toBe(1886.96);
  });
  it('requires an agreement and explicit approval for additions', () => {
    expect(() => buildPayoutEvent('variation', {}, [])).toThrow('Confirm');
    expect(() => buildPayoutEvent('variation', { reference: 'V1' }, [agreement])).toThrow('agreed');
    expect(() => buildPayoutEvent('variation', { reference: 'V1', approved: true, amount: -5 }, [agreement])).toThrow();
  });
  it('adds agreed variations and reconciles part invoices in cents', () => {
    const variation = { ...agreement, id: 'v', kind: 'variation', payload: buildPayoutEvent('variation', { reference: 'V1', approved: true, amount: 100, reason: 'Extra return visit' }, [agreement]) } as PayoutEvent;
    const invoice = { ...agreement, id: 'i', kind: 'invoice', payload: buildPayoutEvent('invoice', { reference: 'INV1', amount: 2000, reason: 'Part invoice' }, [agreement]) } as PayoutEvent;
    expect(payoutSummary([agreement, variation, invoice])).toMatchObject({ expected: 2285, invoiced: 2000, difference: -285 });
    expect(() => buildPayoutEvent('invoice', { reference: 'inv1', amount: 2000, reason: 'Again' }, [agreement, invoice])).toThrow('already');
  });
  it.each([NaN, Infinity, -1, '100', null])('rejects invalid money %s', amount => {
    expect(() => buildPayoutEvent('invoice', { reference: 'I1', amount, reason: 'Invoice' }, [agreement])).toThrow();
  });
});
