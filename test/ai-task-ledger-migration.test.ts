import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_ACTOR_KINDS,
  AI_DATA_CLASSIFICATIONS,
  AI_RISK_CLASSES,
  AI_TASK_EVENT_TYPES,
  AI_TASK_STATUSES,
} from '@sp/ai';

const migration = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260818000002_ai_task_ledger.sql',
  ),
  'utf8',
);
const bootstrap = readFileSync(
  path.join(process.cwd(), 'supabase/tests/ai_task_ledger_bootstrap.sql'),
  'utf8',
);
const executableContract = readFileSync(
  path.join(process.cwd(), 'supabase/tests/ai_task_ledger.sql'),
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

describe('PR-AI-004 AI task ledger migration', () => {
  it('keeps database registries aligned with the provider-neutral package', () => {
    expect(enumValues(migration, 'ai_task_status')).toEqual(AI_TASK_STATUSES);
    expect(enumValues(migration, 'ai_task_event_type')).toEqual(
      AI_TASK_EVENT_TYPES,
    );
    expect(enumValues(migration, 'ai_task_risk_class')).toEqual(AI_RISK_CLASSES);
    expect(enumValues(migration, 'ai_data_classification')).toEqual(
      AI_DATA_CLASSIFICATIONS,
    );
    expect(tableDefinition('public', 'ai_task_events')).toContain(
      `actor_kind text not null check (actor_kind in (${AI_ACTOR_KINDS.map((kind) => `'${kind}'`).join(', ')}))`,
    );
  });

  it('separates staff-safe metadata from frozen private input', () => {
    const publicTask = tableDefinition('public', 'ai_tasks');
    const privatePayload = tableDefinition('private', 'ai_task_payloads');

    expect(publicTask).toMatch(/safe_objective text not null/i);
    expect(publicTask).not.toMatch(/\bobjective text|\bpayload jsonb|fixture_key/i);
    expect(privatePayload).toMatch(/objective text not null/i);
    expect(privatePayload).toMatch(/payload jsonb not null/i);
    expect(privatePayload).toMatch(/retain_until timestamptz not null/i);
    expect(privatePayload).toMatch(/interval '30 days'/i);
    expect(migration).toMatch(/ai_task_payloads_immutable_trigger/i);
    expect(migration).toMatch(/ai_task_events_append_only_trigger/i);
    expect(migration).toMatch(/ai_task_command_receipts_append_only_trigger/i);
  });

  it('structurally limits this slice to synthetic, effect-free, zero-cost work', () => {
    const publicTask = tableDefinition('public', 'ai_tasks');
    const createSynthetic = functionDefinition(
      'public.ai_task_create_synthetic',
    );

    expect(publicTask).toContain("task_type ~ '^synthetic\\.[a-z0-9._-]+$'");
    expect(publicTask).toMatch(/execution_mode = 'synthetic'/i);
    expect(publicTask).toMatch(/effect_class = 'none'/i);
    expect(publicTask).toMatch(/max_cost_cents = 0/i);
    expect(publicTask).toMatch(/actual_cost_cents = 0/i);
    expect(createSynthetic).toMatch(/'echo_v1', 'classification_v1'/i);
    expect(createSynthetic).toMatch(/'executionMode', 'synthetic'/i);
    expect(createSynthetic).toMatch(/'effectClass', 'none'/i);
    expect(migration).not.toMatch(/https?:|openclaw|resend|provider[_ .-]?key/i);
  });

  it('exposes idempotent semantic commands without direct mutations', () => {
    const createSynthetic = functionDefinition(
      'public.ai_task_create_synthetic',
    );
    const cancelSynthetic = functionDefinition(
      'public.ai_task_cancel_synthetic',
    );

    for (const command of [createSynthetic, cancelSynthetic]) {
      expect(command).toMatch(/security definer/i);
      expect(command).toMatch(/set search_path = pg_catalog/i);
      expect(command).toMatch(/pg_advisory_xact_lock/i);
      expect(command).toMatch(/extensions\.digest/i);
    }
    expect(createSynthetic).toMatch(/was_replayed/i);
    expect(createSynthetic).toMatch(/errcode = '23505'/i);
    expect(cancelSynthetic).toMatch(/ai_task_command_receipts/i);
    expect(cancelSynthetic).toMatch(/was_already_applied/i);
    expect(migration).toMatch(
      /revoke all on table public\.ai_tasks from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(/grant select on table public\.ai_tasks to authenticated/i);
    expect(migration).not.toMatch(/grant (insert|update|delete)/i);
  });

  it('ships executable RLS, replay, immutability, and rollback evidence', () => {
    expect(bootstrap).toMatch(/to_regprocedure\('auth\.uid\(\)'\) is null/i);
    expect(bootstrap).toMatch(/create function auth\.uid\(\)/i);
    expect(executableContract).toMatch(/all AI ledger tables must have RLS enabled/i);
    expect(executableContract).toMatch(/same create intent did not replay/i);
    expect(executableContract).toMatch(/unrelated staff member cancelled/i);
    expect(executableContract).toMatch(/event history accepted an update/i);
    expect(harness).toMatch(/begin;\\n\$\{taskLedgerMigration\}\\nrollback;/i);
    expect(harness).toMatch(/Rollback residue query/i);
    expect(harness).toMatch(/supabase\/tests\/ai_task_ledger\.sql/i);
    expect(harness).not.toMatch(/SUPABASE_(URL|SERVICE_ROLE_KEY)/i);
  });
});
