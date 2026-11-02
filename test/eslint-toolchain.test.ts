// @vitest-environment node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { beforeAll, expect, it } from 'vitest';

const root = process.cwd(), require = createRequire(import.meta.url);
const engine = () => new ESLint({ cwd: root, overrideConfigFile: path.join(root, 'eslint.config.mjs') });
// Load the real parser/configuration once as suite setup, outside per-case assertions.
beforeAll(async () => {
  await engine().calculateConfigForFile('apps/portal/components/designStudio/StudioProjectEntry.tsx');
}, 30_000);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

it('preserves the complete previous root rule policy while running the fixed toolchain', async () => {
  const config = await engine().calculateConfigForFile('apps/portal/components/designStudio/StudioProjectEntry.tsx');
  const rules = Object.fromEntries(Object.entries(config.rules).map(([name, raw]) => {
    const value = raw as unknown[];
    // ESLint 10 displays defaults for disabled rules and its newly optional
    // relational check. False retains the previous non-relational behavior.
    return [name, value[0] === 0 ? [0] : name === 'no-constant-binary-expression' && JSON.stringify(value) === '[2,{"checkRelationalComparisons":false}]' ? [2] : value];
  }));
  expect(Object.keys(rules)).toHaveLength(64);
  // Captured from the previous ESLint 9.39.2 root policy before the update.
  expect(createHash('sha256').update(JSON.stringify(canonical(rules))).digest('hex')).toBe('37a7c580f5de788a4e7132ddfe11019c7467a5d11da51795ccd92548a179d944');
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  expect(manifest.scripts.lint).toContain('eslint --config eslint.config.mjs .');
});

it('continues rejecting forbidden imports and direct browser reads while preserving valid server/query boundaries', async () => {
  const lint = engine();
  const [bad] = await lint.lintText("import old from '@/src/costing/engine/test'; import cache from 'next/cache'; supabase.from('synthetic');", { filePath: 'apps/portal/components/ToolchainContract.tsx' });
  expect(bad.messages.filter(message => message.ruleId === 'no-restricted-imports')).toHaveLength(2);
  expect(bad.messages.filter(message => message.ruleId === 'no-restricted-syntax')).toHaveLength(1);
  const [valid] = await lint.lintText("import current from '@sp/costing'; export const Component = () => null;", { filePath: 'apps/portal/components/ToolchainContract.tsx' });
  expect(valid.errorCount).toBe(0);
  for (const filePath of ['apps/portal/lib/queries/toolchainContract.ts', 'apps/portal/app/api/toolchain-contract/route.ts']) {
    const [server] = await lint.lintText("supabase.from('synthetic');", { filePath });
    expect(server.messages.some(message => message.ruleId === 'no-restricted-syntax')).toBe(false);
  }
});

it('preserves source selection and generated/public/script ignores through the actual fixed glob consumers', async () => {
  const lint = engine();
  for (const file of ['apps/portal/components/designStudio/StudioProjectEntry.tsx', 'packages/geometry/src/index.ts']) expect(await lint.isPathIgnored(path.join(root, file))).toBe(false);
  for (const file of ['node_modules/example/index.js', 'apps/portal/.next/example.js', 'apps/portal/public/example.js', 'scripts/example.js']) expect(await lint.isPathIgnored(path.join(root, file))).toBe(true);
  const eslintRequire = createRequire(require.resolve('eslint'));
  const parserRequire = createRequire(require.resolve('@typescript-eslint/parser'));
  const loaders = [eslintRequire, createRequire(eslintRequire.resolve('@eslint/config-array')), createRequire(parserRequire.resolve('@typescript-eslint/typescript-estree'))];
  for (const load of loaders) {
    expect(load('minimatch/package.json').version).toBe('11.0.1');
    const match = load('minimatch');
    expect(match.minimatch('apps/portal/components/Panel.tsx', '**/*.{js,jsx,ts,tsx}')).toBe(true);
    expect(new match.Minimatch('**/.next/**', { dot: true }).match('apps/portal/.next/server.js')).toBe(true);
  }
  expect(() => eslintRequire.resolve('@eslint/eslintrc')).toThrow();
});

it.each(['apps/portal', 'apps/marketing'])('retains the previous own-app shadow rule semantics in %s', async app => {
  const lint = new ESLint({ cwd: path.join(root, app), overrideConfigFile: path.join(root, app, 'eslint.config.mjs') });
  const config = await lint.calculateConfigForFile('app/page.tsx');
  expect(config.rules['no-shadow-restricted-names']).toEqual([2, { reportGlobalThis: false }]);
});
