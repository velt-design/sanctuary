import { afterEach, expect, it, vi } from 'vitest';
import { sendGoogleAnalyticsEvent } from './googleAnalyticsEvent';

afterEach(() => vi.unstubAllGlobals());

it('routes API events to the verified stream without allowing payload overrides', () => {
  const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
  expect(sendGoogleAnalyticsEvent('contact_success', { configured_design: true, send_to: 'untrusted' }, true)).toBe(true);
  expect(gtag).toHaveBeenCalledWith('event', 'contact_success', { configured_design: true, send_to: 'G-KGLF83X6JW' });
});

it('sends nothing with denied consent or an unavailable runtime', () => {
  const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
  expect(sendGoogleAnalyticsEvent('contact_success', {}, false)).toBe(false);
  expect(gtag).not.toHaveBeenCalled();
  vi.stubGlobal('gtag', undefined);
  expect(sendGoogleAnalyticsEvent('contact_success', {}, true)).toBe(false);
});

it('does not let a vendor failure interrupt the customer action', () => {
  vi.stubGlobal('gtag', () => { throw new Error('vendor unavailable'); });
  expect(sendGoogleAnalyticsEvent('contact_error', {}, true)).toBe(false);
});
