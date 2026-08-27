import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveVitestMaxWorkers } from './vitestWorkerPolicy';

describe('Vitest worker policy', () => {
  it('uses four workers in CI and eight workers locally', () => {
    expect(resolveVitestMaxWorkers({ CI: 'true' })).toBe(4);
    expect(resolveVitestMaxWorkers({ CI: '1' })).toBe(4);
    expect(resolveVitestMaxWorkers({})).toBe(8);
    expect(resolveVitestMaxWorkers({ CI: 'false' })).toBe(8);
  });

  it('honours a positive explicit override in every environment', () => {
    expect(resolveVitestMaxWorkers({ VITEST_MAX_WORKERS: '1' })).toBe(1);
    expect(
      resolveVitestMaxWorkers({ CI: 'true', VITEST_MAX_WORKERS: ' 12 ' }),
    ).toBe(12);
    expect(resolveVitestMaxWorkers({ VITEST_MAX_WORKERS: '65' })).toBe(65);
  });

  it.each(['', '0', '-1', '1.5', 'eight', '9007199254740992'])(
    'rejects invalid override %j',
    (configured) => {
      expect(() =>
        resolveVitestMaxWorkers({ VITEST_MAX_WORKERS: configured }),
      ).toThrow('VITEST_MAX_WORKERS must be a positive safe integer.');
    },
  );

  it('keeps the root and Worker Vitest configs on the shared policy', () => {
    for (const configPath of ['vitest.config.ts', 'apps/worker/vitest.config.ts']) {
      const source = readFileSync(path.resolve(process.cwd(), configPath), 'utf8');
      expect(source, configPath).toContain('resolveVitestMaxWorkers');
      expect(source, configPath).toContain('maxWorkers: resolveVitestMaxWorkers()');
    }
  });
});
