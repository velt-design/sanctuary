import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Marketing experiment runtime dependencies', () => {
  it('declares its directly imported schema runtime in the deployable workspace and frozen lock entry', () => {
    const marketing = JSON.parse(readFileSync(resolve('apps/marketing/package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(resolve('package-lock.json'), 'utf8'));
    for (const file of ['apps/marketing/app/api/landing-experiment/route.ts', 'apps/marketing/lib/landingExperiment.server.ts']) {
      expect(readFileSync(resolve(file), 'utf8')).toMatch(/from ['"]zod['"]/);
    }
    expect(marketing.dependencies.zod).toBe(lock.packages['node_modules/zod'].version);
    expect(lock.packages['apps/marketing'].dependencies.zod).toBe(marketing.dependencies.zod);
    expect(marketing.devDependencies.zod).toBeUndefined();
  });
});
