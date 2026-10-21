import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('disposable revised quote proxy boundary', () => {
  it.each([GET, POST])('withholds the fixture in production even when the QA flag is set', async handler => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '1');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const result = await handler(new Request('http://localhost/api/qa/revised-quote-fixture/api/accept'), { params: Promise.resolve({ path: ['api','accept'] }) });
    expect(result.status).toBe(404); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires the development flag before contacting the local adapter', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '0');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const result = await GET(new Request('http://localhost/api/qa/revised-quote-fixture/api/status'), { params: Promise.resolve({ path: ['api','status'] }) });
    expect(result.status).toBe(404); expect(fetch).not.toHaveBeenCalled();
  });
});
