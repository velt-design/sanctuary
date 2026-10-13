import { afterEach, expect, it, vi } from 'vitest';
import { GET } from './route';
afterEach(() => vi.unstubAllEnvs());
it('keeps preview tracking inert when explicitly disabled', async () => {
  vi.stubEnv('MARKETING_TRACKING_DISABLED', 'true');
  const response = GET();
  expect(await response.text()).not.toContain('pixel.archipro');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('retains the existing production runtime by default', async () => {
  vi.stubEnv('MARKETING_TRACKING_DISABLED', '');
  expect(await GET().text()).toContain('https://pixel.archipro.co.nz/ap-analytics.js');
});
