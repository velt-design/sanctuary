import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260722_000001_portal_search_v1.sql',
);
const migrationSql = readFileSync(migrationPath, 'utf8').toLowerCase();
const performanceMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260722_000002_portal_search_bigram_indexes.sql',
);
const performanceMigrationSql = readFileSync(performanceMigrationPath, 'utf8').toLowerCase();

describe('portal search migration', () => {
  it('provides one RLS-respecting authenticated operation', () => {
    expect(migrationSql).toContain('function public.portal_search_v1');
    expect(migrationSql).toContain('security invoker');
    expect(migrationSql).not.toContain('security definer');
    expect(migrationSql).toContain('public.has_portal_access() as allowed');
    expect(migrationSql).toContain('access_granted boolean');
    expect(migrationSql).toContain('access.allowed as access_granted');
    expect(migrationSql).toContain(
      'grant execute on function public.portal_search_v1(text, integer) to authenticated, service_role',
    );
    expect(migrationSql).toContain(
      'revoke all on function public.portal_search_v1(text, integer) from public, anon',
    );
  });

  it('indexes every canonical search field and the linked-contact join', () => {
    for (const indexName of [
      'projects_name_trgm_idx',
      'projects_quote_ref_trgm_idx',
      'projects_site_address_trgm_idx',
      'projects_contact_id_idx',
      'contacts_name_trgm_idx',
      'contacts_email_trgm_idx',
      'contacts_phone_trgm_idx',
      'contacts_address_trgm_idx',
    ]) {
      expect(migrationSql).toContain(indexName);
    }
    expect(migrationSql).toContain('create extension if not exists pg_trgm');
  });

  it('preserves literal wildcard matching, ranking and bounded groups in SQL', () => {
    expect(migrationSql).toContain("escape e'\\\\'");
    expect(migrationSql).toContain("e'\\\\%'");
    expect(migrationSql).toContain("e'\\\\_'");
    expect(migrationSql).toContain('regexp_split_to_table');
    expect(migrationSql).toContain('greatest(1, least(coalesce(result_limit, 5), 20))');
    expect(migrationSql).toContain('limit (select bounded_limit from search_input)');
  });

  it('keeps two-character contains queries index-backed in the forward migration', () => {
    expect(performanceMigrationSql).toContain('function public.portal_search_bigrams');
    expect(performanceMigrationSql).toContain('immutable');
    expect(performanceMigrationSql).toContain('projects_portal_search_document_bigram_idx');
    expect(performanceMigrationSql).toContain('contacts_portal_search_document_bigram_idx');
    expect(performanceMigrationSql).toContain('contacts_name_portal_search_bigram_idx');
    expect(performanceMigrationSql).toContain('length(input.normalized_query) = 2');
    expect(performanceMigrationSql).toContain('@> array[input.normalized_query]');
  });

  it('preserves the RLS, ranking and grant contract while consolidating trigram indexes', () => {
    expect(performanceMigrationSql).toContain('function public.portal_search_v1');
    expect(performanceMigrationSql).toContain('security invoker');
    expect(performanceMigrationSql).not.toContain('security definer');
    expect(performanceMigrationSql).toContain('public.has_portal_access() as allowed');
    expect(performanceMigrationSql).toContain('projects_portal_search_document_trgm_idx');
    expect(performanceMigrationSql).toContain('contacts_portal_search_document_trgm_idx');
    expect(performanceMigrationSql).toContain('regexp_split_to_table');
    expect(performanceMigrationSql).toContain(
      'grant execute on function public.portal_search_v1(text, integer) to authenticated, service_role',
    );
    expect(performanceMigrationSql).toContain(
      'revoke all on function public.portal_search_v1(text, integer) from public, anon',
    );
  });
});
