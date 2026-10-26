import { afterEach, expect, it, vi } from 'vitest';
import { marketingPreviewReadOnly } from './marketingPreviewReadOnly';

afterEach(() => vi.unstubAllEnvs());
it('does not change normal intake unless the server preview setting is explicitly enabled', async () => {
  vi.stubEnv('MARKETING_PREVIEW_READ_ONLY', ''); expect(marketingPreviewReadOnly()).toBeNull();
  vi.stubEnv('MARKETING_PREVIEW_READ_ONLY', 'true'); const reply = marketingPreviewReadOnly()!;
  expect(reply.status).toBe(503); expect(reply.headers.get('cache-control')).toBe('no-store');
  expect(await reply.json()).toMatchObject({ ok: false, error: expect.stringContaining('preview cannot send enquiries') });
});
