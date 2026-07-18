import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPATIBILITY_CLIENT_FILE = 'apps/portal/lib/supabaseClient.ts';
const SERVICE_ROLE_ALLOWLIST = [
  'apps/portal/app/api/admin/access/route.ts',
  'apps/portal/lib/automation/AutomationRunner.ts',
  'apps/portal/lib/dashboard/getDashboardData.ts',
  'apps/portal/lib/dashboard/getDashboardSnapshotCached.ts',
  'apps/portal/lib/estimates/server.ts',
  'apps/portal/lib/invoices/server.ts',
  'apps/portal/lib/marketingAttribution/server.ts',
  'apps/portal/lib/quotes/serverCore.ts',
  'apps/portal/lib/quotes/serverEmail.ts',
  'apps/portal/lib/quotes/serverLoaders.ts',
  'apps/portal/lib/scheduling/scheduleCommands.ts',
  'apps/portal/lib/scheduling/scheduleReadiness.ts',
  'apps/portal/lib/scheduling/scheduleV2Server.ts',
] as const;

const COMPATIBILITY_CLIENT_PATTERN = /\bsupabaseServer\b|\bgetSupabaseServer\s*\(/;
const SERVICE_ROLE_PATTERN = /\bsupabaseServiceRole\b|\bgetSupabaseServiceRole\s*\(/;

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: process.cwd(), encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function readTrackedFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function portalRuntimeFiles(): string[] {
  return trackedFiles().filter((relativePath) => {
    if (!existsSync(path.join(process.cwd(), relativePath))) return false;
    if (!relativePath.startsWith('apps/portal/app/') && !relativePath.startsWith('apps/portal/lib/')) return false;
    if (relativePath.includes('/vendor/')) return false;
    if (relativePath.includes('.test.')) return false;
    if (relativePath.endsWith('.d.ts')) return false;
    return relativePath.endsWith('.ts') || relativePath.endsWith('.tsx');
  });
}

describe('portal supabase boundaries', () => {
  it('keeps the compatibility server client isolated to the compatibility module', () => {
    const offenders = portalRuntimeFiles().filter(
      (relativePath) => relativePath !== COMPATIBILITY_CLIENT_FILE && COMPATIBILITY_CLIENT_PATTERN.test(readTrackedFile(relativePath)),
    );

    expect(offenders).toEqual([]);
    expect(readTrackedFile(COMPATIBILITY_CLIENT_FILE)).toMatch(COMPATIBILITY_CLIENT_PATTERN);
  });

  it('keeps service-role usage on the explicit allowlist', () => {
    const actualUsers = portalRuntimeFiles()
      .filter((relativePath) => relativePath !== COMPATIBILITY_CLIENT_FILE && SERVICE_ROLE_PATTERN.test(readTrackedFile(relativePath)))
      .sort();

    expect(actualUsers).toEqual([...SERVICE_ROLE_ALLOWLIST].sort());

    for (const relativePath of SERVICE_ROLE_ALLOWLIST) {
      expect(readTrackedFile(relativePath), relativePath).toMatch(SERVICE_ROLE_PATTERN);
      expect(readTrackedFile(relativePath), relativePath).not.toMatch(COMPATIBILITY_CLIENT_PATTERN);
    }
  });
});
