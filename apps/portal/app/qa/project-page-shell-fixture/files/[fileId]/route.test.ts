import { afterEach, expect, it, vi } from 'vitest';
import * as route from './route';
import { workdeskFileRecords } from '../../workdeskFilesFixture';

afterEach(() => vi.unstubAllEnvs());
const get = (id: string, download = false) => route.GET(new Request(`http://localhost/qa/project-page-shell-fixture/files/${id}?download=${download ? '1' : '0'}`), { params: Promise.resolve({ fileId: id }) });

it('returns only finite fictional originals and attachment headers, with no write handler', async () => {
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '1');
  for (const file of workdeskFileRecords) {
    const response = await get(file.id, true);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(file.mime);
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(file.bytes));
  }
  expect((await get('roof-question')).headers.get('content-disposition')).toMatch(/^inline;/);
  expect((await get('unknown-file')).status).toBe(404);
  expect(Object.keys(route)).toEqual(['GET']);
});

it.each([undefined, '0', ''])('returns 404 when the fixture flag is %s', async flag => {
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', flag);
  expect((await get('roof-question', true)).status).toBe(404);
  expect((await get('unknown-file')).status).toBe(404);
});
