import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260723_000001_marketing_enquiry_intake_security.sql'),
  'utf8',
);

describe('marketing enquiry security migration contract', () => {
  it('makes submission IDs unique and serializes concurrent duplicate intake', () => {
    expect(migration).toContain('enquiry_requests_submission_id_uidx');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toMatch(/where submission_id = p_submission_id/);
    expect(migration).toContain('already_existed := true');
  });

  it('keeps contact, project, enquiry, and session consumption in one RPC transaction', () => {
    const intake = migration.slice(
      migration.indexOf('create or replace function public.marketing_enquiry_intake'),
      migration.indexOf('create or replace function public.marketing_enquiry_stale_upload_sessions'),
    );
    expect(intake).toContain('insert into public.contacts');
    expect(intake).toContain('insert into public.projects');
    expect(intake).toContain('insert into public.enquiry_requests');
    expect(intake).toContain('update public.marketing_enquiry_upload_sessions');
    expect(intake).not.toMatch(/\bcommit\b|\brollback\b/i);
  });

  it('binds short-lived uploads and durable limits to service-only RPCs', () => {
    expect(migration).toContain("clock_timestamp() + interval '15 minutes'");
    expect(migration).toContain('marketing_public_rate_limits');
    expect(migration).toContain('marketing_enquiry_upload_sessions');
    expect(migration).toMatch(/revoke all on table public\.marketing_public_rate_limits[\s\S]+service_role/);
    expect(migration).toMatch(/grant execute on function public\.marketing_enquiry_intake[\s\S]+to service_role/);
    expect(migration).not.toMatch(/grant execute[\s\S]{0,200}to (public|anon|authenticated)/);
  });

  it('provides cleanup and bounded retention for abandoned security state', () => {
    expect(migration).toContain('marketing_enquiry_stale_upload_sessions');
    expect(migration).toContain('marketing_enquiry_delete_stale_upload_sessions');
    expect(migration).toContain('cleanup_started_at');
    expect(migration).toContain('for update skip locked');
    expect(migration).toContain("updated_at < clock_timestamp() - interval '2 days'");
    expect(migration).toContain("consumed_at < clock_timestamp() - interval '30 days'");
  });
});
