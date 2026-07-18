import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortalWebVitalEvent } from './webVitals';
import { sendPortalWebVital } from './webVitalsClient';

const event: PortalWebVitalEvent = {
  name: 'INP',
  value: 80,
  rating: 'good',
  routeTemplate: '/dashboard',
  navigationType: 'navigate',
  deviceClass: 'desktop',
};

describe('portal Web Vitals transport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses a successful beacon without starting a fetch', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, value: beacon });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    sendPortalWebVital(event);

    expect(beacon).toHaveBeenCalledWith('/api/staff/v1/performance/web-vitals', expect.any(Blob));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to a non-blocking keepalive fetch when beacon declines', async () => {
    Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, value: vi.fn(() => false) });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    expect(() => sendPortalWebVital(event)).not.toThrow();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledWith('/api/staff/v1/performance/web-vitals', expect.objectContaining({
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
    }));
  });
});
