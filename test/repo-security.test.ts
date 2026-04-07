import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIVATE_KEY_PATTERNS = [
  /BEGIN OPENSSH PRIVATE KEY/,
  /BEGIN RSA PRIVATE KEY/,
  /BEGIN EC PRIVATE KEY/,
  /BEGIN DSA PRIVATE KEY/,
  /PuTTY-User-Key-File-/,
] as const;

const FORBIDDEN_SQL_PATTERNS = [
  /grant usage on schema public to anon, authenticated;/i,
  /grant select, insert, update, delete on all tables in schema public to anon, authenticated;/i,
  /alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;/i,
  /grant select, insert, update, delete on table public\.[a-z0-9_]+ to anon, authenticated;/i,
  /grant select, insert, update, delete on public\.[a-z0-9_]+ to anon, authenticated;/i,
  /grant references on public\.[a-z0-9_]+ to anon, authenticated;/i,
  /grant execute on function public\.schedule_v2_[^(]+\([^)]*\) to anon, authenticated;/i,
] as const;

const REQUIRED_RLS_TABLES = [
  'contacts',
  'projects',
  'site_visit_events',
  'schedule_crews',
  'schedule_events',
  'schedule_items',
  'scheduled_jobs',
  'crew_schedule_items',
  'crew_downtimes',
  'project_task_checks',
  'material_cost_overrides',
  'install_action_minutes_overrides',
  'install_driver_curve_overrides',
  'design_package_requests',
  'design_package_tickets',
  'deposit_invoices',
  'deposit_invoice_send_logs',
  'job_pack_generations',
  'enquiry_requests',
  'portal_users',
  'portal_user_theme_settings',
  'portal_user_theme_presets',
] as const;

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: process.cwd(), encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function readTrackedFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('repo security hardening', () => {
  it('does not track private key material', () => {
    const offenders: string[] = [];

    for (const relativePath of trackedFiles()) {
      if (!existsSync(path.join(process.cwd(), relativePath))) continue;
      const source = readTrackedFile(relativePath);
      if (PRIVATE_KEY_PATTERNS.some((pattern) => pattern.test(source))) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not keep blanket anon/authenticated SQL grants in tracked schema files', () => {
    const sqlFiles = trackedFiles().filter((relativePath) => relativePath.endsWith('.sql'));
    const offenders: Array<{ file: string; pattern: string }> = [];

    for (const relativePath of sqlFiles) {
      const source = readTrackedFile(relativePath);
      for (const pattern of FORBIDDEN_SQL_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push({ file: relativePath, pattern: String(pattern) });
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the hardening migration responsible for RLS coverage on required portal tables', () => {
    const migrationPath = 'supabase/migrations/20260408_000001_portal_security_hardening.sql';
    const source = readTrackedFile(migrationPath);

    expect(source).toMatch(/enable row level security/i);
    expect(source).toMatch(/portal_access_all/i);
    expect(source).toMatch(/revoke execute on function public\.schedule_v2_reorder_queue/i);

    for (const table of REQUIRED_RLS_TABLES) {
      expect(source, table).toContain(`'${table}'`);
    }
  });
});
