import { describe, expect, it } from 'vitest';
import { commandCentreQuoteDeliveryState, normalizeCommandCentreCommercialCandidates } from './commercialSelection';

function quote(logs: { status: string; created_at: string | null; sent_at?: string | null }[], status = 'SENT') {
  return normalizeCommandCentreCommercialCandidates({ quotes: [{ id: 'quote', quoteVersions: [{
    id: 'version', status, sendLogs: logs,
  }] }] }).quotes[0];
}

describe('shared quote delivery chronology', () => {
  it.each([
    ['2026-10-13T01:00:00.123456Z', '2026-10-13T01:00:00.123456Z', 'failed'],
    ['2026-10-13T01:00:00.123457Z', '2026-10-13T01:00:00.123456Z', 'sent'],
    ['2026-10-13T01:00:00.123455Z', '2026-10-13T01:00:00.123456Z', 'failed'],
    ['2026-10-13T14:00:00.123456+13:00', '2026-10-13T01:00:00.123456Z', 'failed'],
    ['2026-10-13T01:00:00.123Z', '2026-10-13T01:00:00.123000Z', 'failed'],
    ['2026-10-13T00:30:00Z', '2026-10-13T01:00:00+01:00', 'sent'],
    [null, null, 'failed'],
    ['not-a-timestamp', 'also-invalid', 'failed'],
    ['2026-10-13T01:00:00Z', 'not-a-timestamp', 'sent'],
  ])('orders precise instants independently of log transport order (%s / %s)', (sentAt, failedAt, expected) => {
    const logs = [{ status: 'SENT', created_at: sentAt }, { status: 'FAILED', created_at: failedAt }];
    expect(commandCentreQuoteDeliveryState(quote(logs))).toBe(expected);
    expect(commandCentreQuoteDeliveryState(quote([...logs].reverse()))).toBe(expected);
  });
  it('retains source microseconds and uses sent time when recorded time is absent', () => {
    const candidate = quote([{ status: 'SENT', created_at: null, sent_at: '2026-10-13T14:00:00.123457+13:00' },
      { status: 'FAILED', created_at: '2026-10-13T01:00:00.123456Z' }]);
    expect(candidate.sendLogs[0].sentAt).toBe('2026-10-13T01:00:00.123457Z');
    expect(commandCentreQuoteDeliveryState(candidate)).toBe('sent');
  });
  it.each([['ACCEPTED', 'accepted'], ['DRAFT', 'draft']])('preserves the %s quote override', (status, expected) => {
    expect(commandCentreQuoteDeliveryState(quote([{ status: 'FAILED', created_at: '2026-10-13T00:00:00Z' }], status))).toBe(expected);
  });
});
