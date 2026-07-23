import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260723_000001_costing_configuration_versions.sql'),
  'utf8',
).toLowerCase();

describe('costing configuration migration', () => {
  it('stores immutable versions behind a separate atomic publication pointer', () => {
    expect(migrationSql).toContain('create table public.costing_configuration_versions');
    expect(migrationSql).toContain('create table public.costing_configuration_publication');
    expect(migrationSql).toContain('published costing configuration versions are immutable');
    expect(migrationSql).toContain('pg_advisory_xact_lock');
    expect(migrationSql).toContain('is distinct from p_expected_current_version_id');
    expect(migrationSql).toContain('draft.content_hash <> p_expected_content_hash');
  });

  it('requires admin RLS and records an append-only publish audit event', () => {
    expect(migrationSql).toContain('if not public.is_portal_admin()');
    expect(migrationSql).toContain('alter table public.costing_configuration_versions enable row level security');
    expect(migrationSql).toContain('create table public.costing_configuration_audit_events');
    expect(migrationSql).toContain("'version.published'");
    expect(migrationSql).not.toContain('grant update on public.costing_configuration_audit_events');
    expect(migrationSql).not.toContain('grant delete on public.costing_configuration_audit_events');
  });

  it('links estimates only to published versions with restrictive deletion', () => {
    expect(migrationSql).toContain('add column costing_config_version_id uuid null');
    expect(migrationSql).toContain('references public.costing_configuration_versions(id) on delete restrict');
    expect(migrationSql).toContain('estimate costing provenance must reference a published configuration version');
  });
});
