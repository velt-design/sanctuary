// @vitest-environment node
import { afterEach,expect,it,vi } from 'vitest';
vi.mock('node:fs/promises',()=>({readFile:vi.fn()}));
import { readFile } from 'node:fs/promises';
import { readPreviewSnapshot } from './readSnapshot';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('never reads the private artifact outside explicit preview mode',async()=>{
  vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW','staging');
  expect(await readPreviewSnapshot('2026-09-01','2026-09-22')).toBeNull();
  vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW','production-snapshot');vi.stubEnv('VERCEL_ENV','production');
  await expect(readPreviewSnapshot('2026-09-01','2026-09-22')).rejects.toThrow();
  expect(readFile).not.toHaveBeenCalled();
});
