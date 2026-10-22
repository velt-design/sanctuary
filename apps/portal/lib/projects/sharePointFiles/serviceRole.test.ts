// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

function removeFixture(repo: string, parent: string) {
  const target = realpathSync(repo);
  if (dirname(target) !== parent || !basename(target).startsWith('sanctuary-sharepoint-boundary-')) throw new Error('Unexpected temporary fixture path');
  rmSync(target, { recursive: true, force: true });
}

it('registers only the reviewed provisioning adapter and keeps nearby privileged files denied', () => {
  const parent = realpathSync(tmpdir());
  const repo = mkdtempSync(join(parent, 'sanctuary-sharepoint-boundary-'));
  const reporter = resolve('scripts/service-role-access-report.mjs');
  const directory = 'apps/portal/lib/projects/sharePointFiles';
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    return result.stdout.trim();
  };
  try {
    git('init'); git('config', 'user.email', 'fixture@example.com'); git('config', 'user.name', 'Fixture');
    git('commit', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    mkdirSync(join(repo, directory), { recursive: true }); mkdirSync(join(repo, 'scripts'));
    writeFileSync(join(repo, directory, 'provision.ts'), 'getSupabaseServiceRole();\n');
    writeFileSync(join(repo, 'scripts/sharepoint-project-files.ts'), 'process.env.SUPABASE_SERVICE_ROLE_KEY;\n');
    git('add', '.'); git('commit', '-m', 'reviewed entrypoints');
    const report = () => spawnSync(process.execPath, [reporter, '--changed', '--strict'], {
      cwd: repo, encoding: 'utf8', env: { ...process.env, ARCHITECTURE_CHANGED_BASE: base, ARCHITECTURE_CHANGED_HEAD: 'HEAD' },
    });
    const allowed = report();
    expect(allowed.status, allowed.stderr || allowed.stdout).toBe(0);
    expect(allowed.stdout).toContain('scoped project-folder lease/publication RPC owner');
    expect(allowed.stdout).toContain('operator-only verified SharePoint binding import');
    writeFileSync(join(repo, directory, 'provision-extra.ts'), 'getSupabaseServiceRole();\n');
    writeFileSync(join(repo, directory, 'server.ts'), 'getSupabaseServiceRole();\n');
    git('add', '.'); git('commit', '-m', 'unreviewed privileged neighbours');
    const denied = report();
    expect(denied.status).toBe(1);
    expect(denied.stderr).toContain(`${directory}/provision-extra.ts`);
    expect(denied.stderr).toContain(`${directory}/server.ts`);
    expect(denied.stderr).not.toContain(`${directory}/provision.ts`);
  } finally {
    removeFixture(repo, parent);
  }
});
