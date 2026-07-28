// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260728_000001_commercial_workflow_trust.sql',
);
const staleConflictMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260728000002_commercial_quote_stale_conflict.sql',
);

let sql = '';
let staleConflictSql = '';

describe('commercial workflow trust migration', () => {
  beforeAll(async () => {
    [sql, staleConflictSql] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(staleConflictMigrationPath, 'utf8'),
    ]);
  });

  it('owns estimate and quote idempotency plus one authoritative draft', () => {
    expect(sql).toContain('estimates_project_client_intent_unique');
    expect(sql).toContain('quote_versions_quote_client_intent_unique');
    expect(sql).toContain('quote_versions_one_current_draft');
    expect(sql).toContain('commercial_quote_create_draft');
    expect(sql).toContain('commercial_quote_update_draft');
    expect(sql).toContain('commercial_quote_prepare_delivery_email');
    expect(sql).toContain('commercial_revision bigint not null default 1');
    expect(sql).toContain(
      'v_current.commercial_revision is distinct from p_expected_commercial_revision',
    );
    expect(sql).toContain('commercial_revision = commercial_revision + 1');
    expect(sql).toContain('update public.deposit_invoices invoice');
    expect(sql).toContain(
      'invoice.quote_version_id <> v_version.id',
    );
    expect(sql).toContain('delivery_prepared_at = now()');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql.indexOf('function public.commercial_email_prepare(')).toBeLessThan(
      sql.indexOf(
        'function public.commercial_quote_prepare_delivery_email(',
      ),
    );
  });

  it('accepts and creates the version-bound deposit invoice atomically', () => {
    expect(sql).toContain('commercial_accept_quote_and_ensure_invoice');
    expect(sql).toContain('deposit_invoices_quote_version_open_unique');
    expect(sql).toContain("raise exception 'QUOTE_EXPIRED'");
    expect(sql).toContain("v_version.status = 'ACCEPTED'");
  });

  it('keeps frozen delivery state private and service-role only', () => {
    expect(sql).toContain('private.commercial_email_intents');
    expect(sql).toContain(
      'commercial_email_intents_one_unfinished_subject',
    );
    expect(sql).toContain(
      'commercial_email_intents_provider_message_unique',
    );
    expect(sql).toContain('commercial_email_read_unfinished');
    expect(sql).toContain('commercial_email_mark_provider_accepted');
    expect(sql).toContain('commercial_email_mark_finalised');
    expect(sql).toMatch(
      /revoke all on table private\.commercial_email_intents\s+from public, anon, authenticated, service_role;/,
    );
    expect(sql).not.toMatch(
      /grant all on table private\.commercial_email_intents to service_role/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.commercial_email_read\([\s\S]*?from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.commercial_email_read\([\s\S]*?to service_role;/,
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.commercial_email_(?:read|prepare|mark)[\s\S]*?to (?:anon|authenticated);/,
    );
    expect(sql).toContain(
      "status in ('provider_accepted', 'finalised', 'needs_attention')",
    );
  });

  it('removes the request-timer retry promise from persisted presentation state', () => {
    expect(sql).toMatch(
      /update public\.deposit_invoice_send_logs\s+set next_retry_at = null/,
    );
  });

  it('keeps stale quote revisions outside the retryable serialization class', () => {
    expect(staleConflictSql).toContain(
      "raise exception 'QUOTE_STALE' using errcode = 'P0001'",
    );
    expect(staleConflictSql).not.toContain("errcode = '40001'");
  });
});
