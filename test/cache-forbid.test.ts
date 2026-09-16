import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('ignores isolated Next output but still rejects forbidden imports in authored portal source', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sanctuary-cache-guard-'));
  const script = path.resolve('scripts/cache-forbid.mjs');
  const write = (relative: string) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "import { unstable_cache } from 'next/cache';");
  };
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  try {
    write('apps/portal/.next-staging-enquiry/dev/server/chunks/framework.js');
    expect(run().status).toBe(0);
    write('apps/portal/app/page.tsx');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path.join('apps', 'portal', 'app', 'page.tsx'));
    expect(result.stderr).not.toContain('framework.js');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
