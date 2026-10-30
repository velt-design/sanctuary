// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || result.stdout || 'git failed');
  return result.stdout.trim();
}

it('admits only the seven reviewed Studio server owners in a committed-base strict comparison', () => {
  const temporaryRoot = realpathSync(tmpdir());
  const repository = mkdtempSync(join(temporaryRoot, 'sanctuary-studio-role-'));
  if (dirname(repository) !== temporaryRoot || !basename(repository).startsWith('sanctuary-studio-role-')) {
    throw Error('Unexpected temporary fixture path');
  }
  const directory = 'apps/portal/lib/designStudio';
  const approved = ['createCommand.server.ts', 'saveCommand.server.ts', 'quotePrepare.server.ts',
    'atomicQuoteCreate.server.ts', 'clientDocuments.server.ts', 'clientDocumentRequest.server.ts', 'clientPackageContext.server.ts'].map(name => `${directory}/${name}`);
  try {
    git(repository, ['init']);
    git(repository, ['config', 'user.email', 'fixture@example.com']);
    git(repository, ['config', 'user.name', 'Fixture']);
    git(repository, ['commit', '--allow-empty', '-m', 'base']);
    const base = git(repository, ['rev-parse', 'HEAD']);
    const write = (file: string) => {
      mkdirSync(dirname(join(repository, file)), { recursive: true });
      writeFileSync(join(repository, file), "import 'server-only';\ngetSupabaseServiceRole();\n");
    };
    const report = () => spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/service-role-access-report.mjs', import.meta.url)), '--changed', '--strict',
    ], {
      cwd: repository, encoding: 'utf8',
      env: { ...process.env, ARCHITECTURE_CHANGED_BASE: base, ARCHITECTURE_CHANGED_HEAD: 'HEAD' },
    });
    approved.forEach(write);
    git(repository, ['add', '.']);
    git(repository, ['commit', '-m', 'reviewed command fixtures']);
    const accepted = report();
    expect(accepted.status, accepted.stderr || accepted.stdout).toBe(0);
    expect(accepted.stdout).toContain('7 new-growth');
    approved.forEach(file => expect(accepted.stdout).toContain(file));

    const unapproved = [
      `${directory}/createCommand-extra.server.ts`,
      `${directory}/atomicQuoteCreate-extra.server.ts`,
      `${directory}/clientDocuments-extra.server.ts`,
      `${directory}/other/clientPackageContext.server.ts`,
      `${directory}/saveCommand.ts`,
      `${directory}/other/quotePrepare.server.ts`,
      'apps/portal/lib/unreviewed/createCommand.server.ts',
      'apps/portal/components/designStudio/saveCommand.server.ts',
    ];
    unapproved.forEach(write);
    git(repository, ['add', '.']);
    git(repository, ['commit', '-m', 'unreviewed neighbor fixtures']);
    const rejected = report();
    expect(rejected.status).toBe(1);
    unapproved.forEach(file => expect(rejected.stderr).toContain(file));
    approved.forEach(file => expect(rejected.stderr).not.toContain(`- ${file} (`));
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
