import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_APPROVAL_DECISIONS,
  AI_APPROVAL_STATUSES,
} from '@sp/ai';

const migration = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260818000003_ai_approval_envelopes.sql',
  ),
  'utf8',
);
const executableContract = readFileSync(
  path.join(process.cwd(), 'supabase/tests/ai_approval_envelopes.sql'),
  'utf8',
);
const harness = readFileSync(
  path.join(process.cwd(), 'scripts/test-ai-task-ledger-db.mjs'),
  'utf8',
);

function enumValues(source: string, enumName: string): string[] {
  const block = source.match(
    new RegExp(
      `create type public\\.${enumName} as enum \\(([\\s\\S]*?)\\);`,
      'i',
    ),
  )?.[1];
  if (!block) throw new Error(`Missing SQL enum ${enumName}`);
  return Array.from(block.matchAll(/'([^']+)'/g), (match) => match[1]);
}

function tableDefinition(schema: string, table: string): string {
  const definition = migration.match(
    new RegExp(
      `create table ${schema}\\.${table} \\(([\\s\\S]*?)\\n\\);`,
      'i',
    ),
  )?.[0];
  if (!definition) throw new Error(`Missing table ${schema}.${table}`);
  return definition;
}

function functionDefinition(qualifiedName: string): string {
  const escaped = qualifiedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definition = migration.match(
    new RegExp(
      `create or replace function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`,
      'i',
    ),
  )?.[0];
  if (!definition) throw new Error(`Missing function ${qualifiedName}`);
  return definition;
}

describe('PR-AI-005 exact approval migration', () => {
  it('keeps approval status and decision registries aligned with @sp/ai', () => {
    expect(enumValues(migration, 'ai_approval_status')).toEqual(
      AI_APPROVAL_STATUSES,
    );
    expect(enumValues(migration, 'ai_approval_decision')).toEqual(
      AI_APPROVAL_DECISIONS,
    );
  });

  it('keeps safe approval metadata public and the exact payload private', () => {
    const safeApproval = tableDefinition('public', 'ai_approvals');
    const privateEnvelope = tableDefinition('private', 'ai_approval_envelopes');

    expect(safeApproval).toMatch(/payload_hash text not null/i);
    expect(safeApproval).toMatch(/payload_summary text not null/i);
    expect(safeApproval).toMatch(/required_role text not null default 'admin'/i);
    expect(safeApproval).toMatch(/single_use boolean not null default true check \(single_use\)/i);
    expect(safeApproval).not.toMatch(/\bpayload jsonb|private_objective|task_input/i);
    expect(privateEnvelope).toMatch(/payload jsonb not null/i);
    expect(migration).toMatch(/ai_approval_envelopes_immutable_trigger/i);
    expect(migration).toMatch(/ai_approval_command_receipts_append_only_trigger/i);
  });

  it('binds request, decision, consumption, and invalidation to exact commands', () => {
    const names = [
      'public.ai_approval_request_synthetic',
      'public.ai_approval_decide_synthetic',
      'public.ai_approval_consume_synthetic',
      'public.ai_approval_invalidate_synthetic',
    ] as const;

    for (const name of names) {
      const definition = functionDefinition(name);
      expect(definition).toMatch(/security definer/i);
      expect(definition).toMatch(/set search_path = pg_catalog/i);
      expect(definition).toMatch(/pg_advisory_xact_lock/i);
      expect(definition).toMatch(/ai_approval_command_receipts/i);
      expect(definition).toMatch(/command_hash/i);
      expect(definition).toMatch(/was_replayed/i);
    }

    expect(functionDefinition('public.ai_approval_consume_synthetic')).toMatch(
      /single-use and was already consumed/i,
    );
    expect(functionDefinition('public.ai_approval_consume_synthetic')).toMatch(
      /taskInputSnapshotHash[\s\S]*input_snapshot_hash/i,
    );
    expect(functionDefinition('public.ai_approval_decide_synthetic')).toMatch(
      /is_portal_admin\(\)/i,
    );
  });

  it('preserves synthetic-only, effect-free and no-network scope', () => {
    const request = functionDefinition('public.ai_approval_request_synthetic');
    const consume = functionDefinition('public.ai_approval_consume_synthetic');

    expect(request).toMatch(/execution_mode <> 'synthetic'/i);
    expect(request).toMatch(/effect_class <> 'none'/i);
    expect(request).toMatch(/'effectClass', 'none'/i);
    expect(consume).toMatch(/no external effect occurred/i);
    expect(migration).not.toMatch(/https?:|openclaw|resend|provider[_ .-]?key|fetch\s*\(/i);
  });

  it('revokes direct mutation/private access and grants only semantic commands', () => {
    expect(migration).toMatch(
      /revoke all on table public\.ai_approvals from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /revoke all on table private\.ai_approval_envelopes from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(/grant select on table public\.ai_approvals to authenticated/i);
    expect(migration).not.toMatch(/grant (insert|update|delete)/i);
    expect(migration).not.toMatch(/to service_role;/i);
  });

  it('ships adversarial executable and exact-file rollback evidence', () => {
    expect(executableContract).toMatch(/non-admin decided an approval/i);
    expect(executableContract).toMatch(/wrong payload hash consumed an approval/i);
    expect(executableContract).toMatch(/single-use approval was consumed twice/i);
    expect(executableContract).toMatch(/expired approval accepted a decision/i);
    expect(executableContract).toMatch(/rejected approval was consumed/i);
    expect(executableContract).toMatch(/cancelled task approval was not invalidated/i);
    expect(executableContract).toMatch(/invalidation erased prior approval evidence/i);
    expect(harness).toMatch(/begin;\\n\$\{approvalMigration\}\\nrollback;/i);
    expect(harness).toMatch(/Approval rollback residue query/i);
    expect(harness).toMatch(/supabase\/tests\/ai_approval_envelopes\.sql/i);
  });
});
