import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getBackgroundJobDefinition } from '@sp/jobs';

const migrationPath = 'supabase/migrations/20260818000004_ai_synthetic_execution.sql';
const migration = readFileSync(path.join(process.cwd(), migrationPath), 'utf8');
const executableContract = readFileSync(
  path.join(process.cwd(), 'supabase/tests/ai_synthetic_execution.sql'),
  'utf8',
);
const harness = readFileSync(
  path.join(process.cwd(), 'scripts/test-background-jobs-db.mjs'),
  'utf8',
);
const handler = readFileSync(
  path.join(process.cwd(), 'apps/worker/src/handlers/aiSynthetic.ts'),
  'utf8',
);

function tableDefinition(schema: string, table: string): string {
  const definition = migration.match(
    new RegExp(`create table ${schema}\\.${table} \\(([\\s\\S]*?)\\n\\);`, 'i'),
  )?.[0];
  if (!definition) throw new Error(`Missing table ${schema}.${table}`);
  return definition;
}

function functionDefinition(qualifiedName: string): string {
  const escaped = qualifiedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definition = migration.match(
    new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`, 'i'),
  )?.[0];
  if (!definition) throw new Error(`Missing function ${qualifiedName}`);
  return definition;
}

describe('PR-AI-007 synthetic execution migration', () => {
  it('keeps the SQL job-kind policy aligned with @sp/jobs', () => {
    const definition = getBackgroundJobDefinition('ai_synthetic_v1', 1);
    expect(migration).toMatch(/'ai_synthetic_v1',\s*1,\s*'ai-synthetic-workflow',\s*3,\s*30,/i);
    expect(definition.handlerOwner).toBe('ai-synthetic-workflow');
    expect(definition.retry.maxAttempts).toBe(3);
    expect(definition.timeoutMs).toBe(30_000);
    expect(definition.defaultRolloutMode).toBe('worker_enabled');
    expect(definition.hasExternalSideEffect).toBe(false);
    expect(definition.allowedEffectCheckpoints).toEqual([]);
  });

  it('adds immutable task/job, zero-cost usage, and deterministic evaluation evidence', () => {
    expect(tableDefinition('public', 'ai_task_jobs')).toMatch(/job_id uuid primary key/i);
    expect(tableDefinition('public', 'ai_usage_records')).toMatch(/provider_key = 'synthetic\.mock'/i);
    expect(tableDefinition('public', 'ai_usage_records')).toMatch(/cost_cents = 0/i);
    expect(tableDefinition('public', 'ai_evaluations')).toMatch(/evaluator_type = 'deterministic'/i);
    expect(migration).toMatch(/ai_task_jobs_append_only_trigger/i);
    expect(migration).toMatch(/ai_usage_records_append_only_trigger/i);
    expect(migration).toMatch(/ai_evaluations_append_only_trigger/i);
    expect(migration).toMatch(/enable row level security/gi);
  });

  it('keeps enqueue service-only and completion bound to exact frozen fixtures', () => {
    const enqueue = functionDefinition('public.ai_task_enqueue_synthetic');
    const completion = functionDefinition('private.ai_synthetic_job_after_update');
    expect(enqueue).toMatch(/private\.background_job_enqueue_core/i);
    expect(enqueue).toMatch(/'worker_enabled'/i);
    expect(enqueue).toMatch(/'worker'/i);
    expect(enqueue).toMatch(/pg_advisory_xact_lock/i);
    expect(migration).toMatch(/grant execute on function public\.ai_task_enqueue_synthetic\(uuid\)\s+to service_role/i);
    expect(migration).not.toMatch(/grant execute on function public\.ai_task_enqueue_synthetic\(uuid\)\s+to authenticated/i);
    expect(completion).toMatch(/SYNTHETIC_OK/i);
    expect(completion).toMatch(/SYNTHETIC_ONLY/i);
    expect(completion).toMatch(/new\.safe_result <> jsonb_build_object/i);
    expect(completion).toMatch(/new\.has_external_side_effect/i);
  });

  it('ships a deterministic handler with no network or provider adapter', () => {
    expect(handler).toMatch(/parseAiSyntheticJobPayloadV1/);
    expect(handler).toMatch(/executeAiSyntheticFixture/);
    expect(handler).not.toMatch(/\bfetch\s*\(|https?:|openclaw|resend|createClient|provider[_ -]?key/i);
    expect(migration).not.toMatch(/https?:|openclaw|resend|customer|email_dispatch/i);
  });

  it('rehearses exact rollback and proves adversarial completion and role boundaries', () => {
    expect(harness).toMatch(/20260818000004_ai_synthetic_execution\.sql/i);
    expect(harness).toMatch(/Transactional AI synthetic execution rollback rehearsal/i);
    expect(harness).toMatch(/from public\.background_job_kinds\s+where kind = 'ai_synthetic_v1'/i);
    expect(harness).not.toMatch(/select oid from public\.background_job_kinds/i);
    expect(executableContract).toMatch(/classification job accepted the echo fixture result/i);
    expect(executableContract).toMatch(/rejected synthetic result did not roll job completion back atomically/i);
    expect(executableContract).toMatch(/unrelated staff could read synthetic execution evidence/i);
    expect(executableContract).toMatch(/synthetic execution recorded an external effect/i);
  });
});
