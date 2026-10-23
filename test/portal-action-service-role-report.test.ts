// @vitest-environment node

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'git failed');
  return result.stdout.trim();
}

describe('Portal Actions service-role architecture boundary', () => {
  it("allows only the reviewed Portal Actions adapter through the strict service-role gate", () => {
    const repo = mkdtempSync(join(realpathSync(tmpdir()), "sanctuary-service-role-"));
    const directory = "apps/portal/lib/integrations/portalActions";
    try {
      runGit(repo, ["init"]);
      runGit(repo, ["config", "user.email", "fixture@example.com"]);
      runGit(repo, ["config", "user.name", "Fixture"]);
      runGit(repo, ["commit", "--allow-empty", "-m", "base"]);
      const base = runGit(repo, ["rev-parse", "HEAD"]);
      mkdirSync(join(repo, directory), { recursive: true });
      const report = () => spawnSync(process.execPath, [
        fileURLToPath(new URL("../scripts/service-role-access-report.mjs", import.meta.url)),
        "--changed", "--strict",
      ], {
        cwd: repo, encoding: "utf8",
        env: { ...process.env, CI: "true", GITHUB_BASE_REF: "main",
          ARCHITECTURE_CHANGED_BASE: base, ARCHITECTURE_CHANGED_HEAD: "HEAD" },
      });
      writeFileSync(join(repo, directory, "server.ts"), "getSupabaseServiceRole();\n");
      runGit(repo, ["add", "."]);
      runGit(repo, ["commit", "-m", "approved adapter"]);
      const approved = report();
      expect(approved.status, approved.stderr || approved.stdout).toBe(0);
      expect(approved.stdout).toContain("1 new-growth");
      expect(approved.stdout).toContain("portal action grant RPC/lost-conversion server owner");
      // Neither a nearby name nor a same-named adapter in another integration
      // inherits the reviewed file's privilege exception.
      mkdirSync(join(repo, "apps/portal/lib/integrations/unreviewed"), { recursive: true });
      for (const file of [`${directory}/server-extra.ts`, "apps/portal/lib/integrations/unreviewed/server.ts"]) {
        writeFileSync(join(repo, file), "getSupabaseServiceRole();\n");
      }
      runGit(repo, ["add", "."]);
      runGit(repo, ["commit", "-m", "unapproved adapters"]);
      const rejected = report();
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain(`${directory}/server-extra.ts`);
      expect(rejected.stderr).toContain("integrations/unreviewed/server.ts");
      expect(rejected.stderr).not.toContain(`${directory}/server.ts`);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('allows only the exact reviewed Finance register reader, rejecting siblings and browser paths', () => {
    const repo = mkdtempSync(join(realpathSync(tmpdir()), 'sanctuary-finance-service-role-'));
    const approvedFile = 'apps/portal/lib/finance/registerRepository.ts';
    const deniedFiles = [
      'apps/portal/lib/finance/registerRepository-extra.ts',
      'apps/portal/lib/finance/unreviewed.ts',
      'apps/portal/components/finance/registerRepository.tsx',
    ];
    try {
      runGit(repo, ['init']);
      runGit(repo, ['config', 'user.email', 'fixture@example.com']);
      runGit(repo, ['config', 'user.name', 'Fixture']);
      runGit(repo, ['commit', '--allow-empty', '-m', 'base']);
      const base = runGit(repo, ['rev-parse', 'HEAD']);
      const report = () => spawnSync(process.execPath, [
        fileURLToPath(new URL('../scripts/service-role-access-report.mjs', import.meta.url)),
        '--changed', '--strict',
      ], {
        cwd: repo, encoding: 'utf8',
        env: { ...process.env, CI: 'true', GITHUB_BASE_REF: 'main',
          ARCHITECTURE_CHANGED_BASE: base, ARCHITECTURE_CHANGED_HEAD: 'HEAD' },
      });
      mkdirSync(join(repo, 'apps/portal/lib/finance'), { recursive: true });
      writeFileSync(join(repo, approvedFile), "import 'server-only';\nsupabaseServiceRole.rpc('finance_register_v1');\n");
      runGit(repo, ['add', '.']);
      runGit(repo, ['commit', '-m', 'reviewed Finance reader']);
      const approved = report();
      expect(approved.status, approved.stderr || approved.stdout).toBe(0);
      expect(approved.stdout).toContain('1 new-growth');
      expect(approved.stdout).toContain('finance register scoped grant-rechecked server reader');
      mkdirSync(join(repo, 'apps/portal/components/finance'), { recursive: true });
      for (const file of deniedFiles) {
        writeFileSync(join(repo, file), "'use client';\nsupabaseServiceRole.rpc('finance_register_v1');\n");
      }
      runGit(repo, ['add', '.']);
      runGit(repo, ['commit', '-m', 'unreviewed Finance access']);
      const rejected = report();
      expect(rejected.status).toBe(1);
      for (const file of deniedFiles) expect(rejected.stderr).toContain(file);
      expect(rejected.stderr).not.toContain(approvedFile);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

});
