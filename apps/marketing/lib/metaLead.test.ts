// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPendingMetaLeads, emitMetaLead, flushPendingMetaLeads, setMetaLeadPermission } from './metaLead';
import { CONSENT_STORAGE_KEY, createStoredConsent } from './consent';

const target = window as Window & { fbq?: (...args: unknown[]) => void };
let sequence = 0;
const identity = () => `synthetic-submission-${++sequence}`;
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); clearPendingMetaLeads(); setMetaLeadPermission(true); delete target.fbq; });
afterEach(() => { setMetaLeadPermission(false); delete target.fbq; vi.clearAllTimers(); vi.useRealTimers(); });

it('queues the original accepted event once and preserves its submission identity on readiness', () => {
  const id = identity(), event = { lead_event_id: id, enquiry_type: 'residential' };
  emitMetaLead(event, id, true);
  emitMetaLead({ ...event, enquiry_type: 'changed retry' }, id, true);
  const pixel = target.fbq = vi.fn();
  flushPendingMetaLeads(true); flushPendingMetaLeads(true); emitMetaLead(event, id, true);
  expect(pixel.mock.calls).toEqual([['track', 'Lead', event, { eventID: id }]]);
});

it('rejects unresolved or denied permission and drops a pending event after withdrawal', () => {
  emitMetaLead({}, identity(), false);
  emitMetaLead({}, identity(), true);
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(createStoredConsent({ analytics: false, marketing: false })));
  const pixel = target.fbq = vi.fn();
  flushPendingMetaLeads(true); emitMetaLead({}, identity(), true);
  localStorage.removeItem(CONSENT_STORAGE_KEY); flushPendingMetaLeads(true);
  expect(pixel).not.toHaveBeenCalled();
});

it('expires an unavailable runtime queue and bounds its transient storage', () => {
  emitMetaLead({}, identity(), true);
  vi.advanceTimersByTime(60_000);
  const pixel = target.fbq = vi.fn(); flushPendingMetaLeads(true);
  expect(pixel).not.toHaveBeenCalled(); delete target.fbq;
  const ids = Array.from({ length: 9 }, identity);
  for (const id of ids) emitMetaLead({ lead_event_id: id }, id, true);
  target.fbq = pixel; flushPendingMetaLeads(true);
  expect(pixel.mock.calls.map(call => call[3])).toEqual(ids.slice(1).map(id => ({ eventID: id })));
});

it('checks the elapsed deadline when the browser has delayed the expiry callback', () => {
  const before = Date.now(); emitMetaLead({}, identity(), true);
  vi.setSystemTime(before + 60_001);
  const pixel = target.fbq = vi.fn(); flushPendingMetaLeads(true);
  expect(pixel).not.toHaveBeenCalled();
});

it('clears pending work on disposal without claiming a dispatched event can be retried', () => {
  emitMetaLead({}, identity(), true); clearPendingMetaLeads();
  const pixel = target.fbq = vi.fn(() => { throw new Error('Synthetic uncertain queue acceptance'); });
  flushPendingMetaLeads(true); expect(pixel).not.toHaveBeenCalled();
  const id = identity(); emitMetaLead({}, id, true); emitMetaLead({}, id, true); flushPendingMetaLeads(true);
  expect(pixel).toHaveBeenCalledTimes(1);
});
