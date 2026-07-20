import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIVATE_KEY_PATTERNS = [
  new RegExp(['BEGIN OPENSSH', 'PRIVATE KEY'].join(' ')),
  new RegExp(['BEGIN RSA', 'PRIVATE KEY'].join(' ')),
  new RegExp(['BEGIN EC', 'PRIVATE KEY'].join(' ')),
  new RegExp(['BEGIN DSA', 'PRIVATE KEY'].join(' ')),
  new RegExp(['BEGIN', 'PRIVATE KEY'].join(' ')),
  new RegExp(['BEGIN ENCRYPTED', 'PRIVATE KEY'].join(' ')),
  new RegExp(['PuTTY-User', 'Key-File-'].join('-')),
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

const BACKGROUND_JOB_RLS_TABLES = [
  'background_job_kinds',
  'background_jobs',
  'background_job_effects',
  'background_job_events',
  'background_workers',
] as const;

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
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
  }, 15_000);

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

  it('keeps the Wave 3 forward migration responsible for service-only job data', () => {
    const migrationPath = 'supabase/migrations/20260720_000001_background_job_foundation.sql';
    const source = readTrackedFile(migrationPath);

    for (const table of BACKGROUND_JOB_RLS_TABLES) {
      expect(source, table).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
      expect(source, table).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'),
      );
      expect(source, table).toMatch(
        new RegExp(`revoke all on table public\\.${table} from [^;]*\\bservice_role\\b`, 'i'),
      );
    }

    expect(source).toMatch(/create table private\.background_job_payloads/i);
    expect(source).toMatch(/alter table private\.background_job_payloads enable row level security/i);
    expect(source).toMatch(
      /revoke all on table private\.background_job_payloads from public, anon, authenticated, service_role/i,
    );
    expect(source).toMatch(/revoke all on schema pgmq from public, anon, authenticated/i);
  });

  it('keeps verified Resend receipts private, minimal, append-only, and service-RPC-only', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql',
      ),
      'utf8',
    );
    const receiptTable = source.match(
      /create table private\.background_job_provider_receipts[\s\S]*?\n\);/i,
    )?.[0];

    expect(receiptTable).toBeTruthy();
    expect(receiptTable).toMatch(/provider_name = 'resend'/i);
    expect(receiptTable).toMatch(/provider_event_type = 'email\.sent'/i);
    expect(receiptTable).toMatch(/unique \(provider_name, provider_event_id\)/i);
    expect(receiptTable).not.toMatch(
      /recipient|subject|html|body|signature|raw_payload|arbitrary_tags/i,
    );
    expect(source).toMatch(
      /alter table private\.background_job_provider_receipts enable row level security/i,
    );
    expect(source).toMatch(
      /background_job_provider_receipts_append_only_trigger/i,
    );
    expect(source).toMatch(
      /revoke all on table private\.background_job_provider_receipts[\s\S]*?from public, anon, authenticated, service_role/i,
    );
    expect(source).toMatch(
      /revoke all on sequence private\.background_job_provider_receipts_id_seq[\s\S]*?from public, anon, authenticated, service_role/i,
    );
    expect(source).toMatch(
      /p_provider_name is distinct from 'resend'[\s\S]*?p_provider_event_type is distinct from 'email\.sent'/i,
    );
    expect(source).toMatch(
      /revoke all on function public\.background_job_reconcile_verified_provider_acceptance\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.background_job_reconcile_verified_provider_acceptance\([\s\S]*?to service_role/i,
    );
    expect(source).not.toMatch(
      /grant execute[^;]*background_job_reconcile_verified_provider_acceptance[^;]*to (?:public|anon|authenticated)/i,
    );
  });

  it('keeps direct Resend transport inside the shared email-provider package', () => {
    const sourceFile = /\.(?:[cm]?[jt]sx?)$/i;
    const testFixture =
      /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
    const directTransport = [
      /\bfrom\s+['"]resend['"]/,
      /\bimport\s+['"]resend['"]/,
      /\bimport\s*\(\s*['"]resend['"]\s*\)/,
      /\brequire\s*\(\s*['"]resend['"]\s*\)/,
      /\bapi\.resend\.com\b/i,
    ] as const;
    const offenders = trackedFiles().filter((relativePath) => {
      if (!sourceFile.test(relativePath)) return false;
      if (relativePath.startsWith('packages/email-provider/')) return false;
      if (testFixture.test(relativePath)) return false;
      if (!existsSync(path.join(process.cwd(), relativePath))) return false;
      const source = readTrackedFile(relativePath);
      return directTransport.some((pattern) => pattern.test(source));
    });

    expect(offenders).toEqual([]);
  });
});
