// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function config(mode: 'development' | 'production', ci: string, distDir: string) {
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('CI', ci);
  vi.stubEnv('PORTAL_PLAYWRIGHT_DIST_DIR', distDir);
  vi.resetModules();
  return (await import('../apps/portal/next.config')).default;
}

describe('Portal browser-server cache boundary', () => {
  it('does not reopen persisted task graphs between CI development servers', async () => {
    const first = await config('development', 'true', ' .next/playwright-fixture ');
    const next = await config('development', 'true', ' .next/playwright-fixture ');
    expect(first.experimental?.turbopackFileSystemCacheForDev).toBe(false);
    expect(next.experimental?.turbopackFileSystemCacheForDev).toBe(false);
    expect(next.distDir).toBe('.next/playwright-fixture');
    expect(next.experimental?.externalDir).toBe(true);
  });

  it.each([
    ['production', 'true', '.next/playwright-fixture'],
    ['production', 'true', ''],
    ['development', '', '.next/playwright-fixture'],
    ['development', 'true', ''],
  ] as const)('preserves default caching for %s, CI=%s, distDir=%s', async (mode, ci, distDir) => {
    const result = await config(mode, ci, distDir);
    expect(result.experimental).not.toHaveProperty('turbopackFileSystemCacheForDev');
    expect(result.distDir).toBe(distDir || undefined);
  });
});
