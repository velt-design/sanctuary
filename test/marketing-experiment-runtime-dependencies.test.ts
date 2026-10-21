import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Marketing experiment workspace dependencies', () => {
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
  it('declares the existing co-located integration-test dependency only for build/test tooling', () => {
    const marketing = JSON.parse(readFileSync(resolve('apps/marketing/package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(resolve('package-lock.json'), 'utf8'));
    const dependency = '@electric-sql/pglite';
    expect(readFileSync(resolve('apps/marketing/app/api/landing-experiment/probe.integration.test.ts'), 'utf8')).toContain(dependency);
    expect(marketing.devDependencies[dependency]).toBe(lock.packages['node_modules/' + dependency].version);
    expect(lock.packages['apps/marketing'].devDependencies[dependency]).toBe(marketing.devDependencies[dependency]);
    expect(marketing.dependencies[dependency]).toBeUndefined();
    expect(lock.packages['node_modules/' + dependency].dev).toBe(true);
  });
});
