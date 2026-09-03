import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const migration = readFileSync(
  path.join(root, 'supabase/migrations/20260903000001_praxis_context_reporting_v1.sql'),
  'utf8',
);
const server = readFileSync(path.join(root, 'apps/portal/lib/praxis/server.ts'), 'utf8');
const dockerProof = readFileSync(path.join(root, 'scripts/test-praxis-context-reporting-db.mjs'), 'utf8');
const fixture = JSON.parse(readFileSync(path.join(root, 'test/fixtures/praxis-context-v1.json'), 'utf8'));

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }
  return value;
}

describe('Praxis context migration source contract', () => {
  it('defines every approved resource as an explicit versioned projection', () => {
    for (const view of [
      'enquiry_requests_v1', 'contacts_v1', 'projects_v1', 'estimates_v1', 'quotes_v1',
      'quote_versions_v1', 'quote_line_items_v1', 'invoices_v1', 'invoice_plan_items_v1',
      'payments_v1', 'payment_allocations_v1', 'project_financial_truth_v1',
    ]) {
      expect(migration).toContain(`praxis_reporting.${view}`);
    }
    expect(migration).toContain('public.commercial_current_accepted_quote_versions');
    expect(migration).toContain('public.commercial_project_financial_truth');
  });

  it('keeps forbidden source material outside the allowlisted payload builders', () => {
    const projectionSection = migration.slice(
      migration.indexOf('create or replace view praxis_reporting.enquiry_requests_v1'),
      migration.indexOf('create or replace function praxis_reporting.context_page_v1'),
    );
    for (const forbidden of [
      'raw_payload', 'files', 'commercial_design_input', 'accept_token_hash',
      'portal_token_hash', 'content_base64', 'protected_payload', 'provider_message_id',
    ]) {
      expect(projectionSection).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
    expect(migration).toContain('praxis_reporting.safe_nested_json_v1(estimate.inputs)');
    expect(migration).toContain('praxis_reporting.safe_nested_json_v1(estimate.outputs)');
    expect(migration).toContain("or value ~ 'hash$'");
  });

  it('shares all 12 representative, ordered, canonically hashed resource shapes', () => {
    const records = fixture.contextSuccess.records as Array<Record<string, unknown>>;
    expect(records.map((record) => record.resource)).toEqual([
      'enquiry_request', 'contact', 'project', 'estimate', 'quote', 'quote_version',
      'quote_line_item', 'invoice', 'invoice_plan_item', 'payment',
      'payment_allocation', 'project_financial_truth',
    ]);
    for (const record of records) {
      const hash = createHash('sha256').update(JSON.stringify(canonicalize(record.payload))).digest('hex');
      expect(record.recordVersion).toBe(hash);
    }
    const estimate = records.find((record) => record.resource === 'estimate');
    expect(JSON.stringify(estimate?.payload)).toContain('"attachmentSide":"rear"');
    expect(JSON.stringify(records)).not.toMatch(/rawPayload|commercialDesignInput|accessToken|password|filePath|providerError/);
    const keys = records.map((record) => `${record.recordedAt}|${record.resource}|${record.id}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('creates no LOGIN and grants no application or service role', () => {
    expect(migration).toMatch(/create role sanctuary_praxis_reader[\s\S]*?nologin/i);
    expect(migration).not.toMatch(/create role\s+\S+\s+login/i);
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+(service_role|authenticated|anon)/i);
    expect(migration).toContain('revoke all on all tables');
    expect(migration).toContain('revoke all on all sequences');
  });

  it('makes runtime reads bounded and read-only', () => {
    expect(server).toContain("begin('read only'");
    expect(server).toContain("set local statement_timeout = '8s'");
    expect(server).toContain("set local lock_timeout = '2s'");
    expect(server).not.toMatch(/SUPABASE_SERVICE_ROLE|serviceRoleKey|createClient\(/);
    expect(server).toContain("!pgRoleHasServiceRole(identity.runtime_role)");
    expect(server).toContain("'cache-control': 'private, no-store'");
    expect(server).toContain("current_setting('default_transaction_read_only') = 'on'");
    expect(server).toContain("procedure.prosecdef");
    expect(server).toContain("from praxis_reporting.context_page_v1(");
  });

  it('tracks invoice-plan assignment freshness', () => {
    expect(migration).toContain('project_invoice_plan_items_set_updated_at');
    expect(migration).toContain("'updatedAt', item.updated_at");
    expect(dockerProof).toContain('Invoice-plan changedAfter query');
  });

  it('provides a real Docker PostgreSQL LOGIN denial proof', () => {
    expect(dockerProof).toContain("'postgres:17-alpine'");
    for (const proof of [
      'base-table SELECT', 'private-table SELECT', 'auth-table SELECT', 'storage-table SELECT',
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'COPY', 'sequence use', 'write RPC execution',
    ]) {
      expect(dockerProof).toContain(proof);
    }
  });
});
