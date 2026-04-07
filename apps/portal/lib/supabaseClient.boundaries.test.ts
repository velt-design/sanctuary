import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const EXPLICIT_SERVICE_ROLE_FILES = [
  'apps/portal/lib/dashboard/getDashboardSnapshotCached.ts',
  'apps/portal/lib/scheduling/scheduleV2Server.ts',
  'apps/portal/lib/scheduling/scheduleCommands.ts',
  'apps/portal/lib/contacts/serverContactsIndex.ts',
  'apps/portal/lib/projects/serverProjectsIndex.ts',
  'apps/portal/lib/projects/getProjectPageSnapshot.ts',
  'apps/portal/lib/quotes/serverCore.ts',
  'apps/portal/lib/invoices/server.ts',
  'apps/portal/lib/estimates/server.ts',
] as const;

describe('explicit service-role boundaries', () => {
  it('keeps the PR18 hot-path allowlist off the compatibility client', () => {
    for (const relativePath of EXPLICIT_SERVICE_ROLE_FILES) {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toMatch(/\bsupabaseServiceRole\b|\bgetSupabaseServiceRole\b/);
      expect(source, relativePath).not.toMatch(/\bsupabaseServer\b|\bgetSupabaseServer\s*\(/);
    }
  });
});
