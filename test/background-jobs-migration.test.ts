import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_JOB_EFFECT_STATES,
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_ROLLOUT_MODES,
  BACKGROUND_JOB_STATUSES,
  getBackgroundJobDefinition,
} from '@sp/jobs';

const migrationNames = [
  '20260720_000001_background_job_foundation.sql',
  '20260720_000002_background_job_enqueue_claim.sql',
  '20260720_000003_background_job_lifecycle.sql',
  '20260720_000004_background_job_reconciliation.sql',
] as const;

function migration(name: (typeof migrationNames)[number]): string {
  return readFileSync(path.join(process.cwd(), 'supabase/migrations', name), 'utf8');
}

const foundation = migration(migrationNames[0]);
const enqueueAndClaim = migration(migrationNames[1]);
const lifecycle = migration(migrationNames[2]);
const reconciliation = migration(migrationNames[3]);
const allMigrations = migrationNames.map(migration).join('\n');

function enumValues(source: string, enumName: string): string[] {
  const block =
    source.match(new RegExp(`create type public\\.${enumName} as enum \\(([\\s\\S]*?)\\);`, 'i'))?.[1] ?? '';
  return Array.from(block.matchAll(/'([^']+)'/g), (match) => match[1]);
}

describe('Wave 3 background-job migrations', () => {
  it('creates one logged PGMQ queue with the exact minimal message contract', () => {
    expect(foundation).toMatch(/pgmq\.create\('portal_background_jobs'\)/i);
    expect(foundation).toMatch(/queue\.is_unlogged/i);
    expect(foundation).toMatch(/portal_background_jobs must be a logged queue/i);
    expect(allMigrations).not.toMatch(/create_unlogged/i);
    const sendMessageBody = enqueueAndClaim.match(
      /create or replace function private\.background_job_send_message[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(sendMessageBody).toBeTruthy();
    expect(sendMessageBody).toMatch(
      /jsonb_build_object\(\s*'jobId', p_job_id,\s*'contractVersion', p_contract_version\s*\)/i,
    );
    expect(sendMessageBody).not.toMatch(/email|recipient|token|attachment|payload|customer/i);
  });

  it('keeps TypeScript and database status, effect, rollout, and kind registries aligned', () => {
    expect(enumValues(foundation, 'background_job_status')).toEqual(BACKGROUND_JOB_STATUSES);
    expect(enumValues(foundation, 'background_job_effect_state')).toEqual(BACKGROUND_JOB_EFFECT_STATES);
    expect(enumValues(foundation, 'background_job_rollout_mode')).toEqual(BACKGROUND_JOB_ROLLOUT_MODES);

    const seededKinds = Array.from(
      foundation.matchAll(/\('([a-z][a-z0-9_]+)',\s*1,\s*'[a-z0-9-]+'/g),
      (match) => match[1],
    );
    expect(seededKinds).toEqual(BACKGROUND_JOB_KINDS);

    for (const kind of BACKGROUND_JOB_KINDS) {
      const definition = getBackgroundJobDefinition(kind);
      const requiredEffects = definition.requiredEffectCheckpoints.length
        ? `array\\['${definition.requiredEffectCheckpoints.join("', '")}']`
        : 'array\\[\\]::text\\[\\]';
      expect(foundation, `${kind} required external effects`).toMatch(
        new RegExp(`\\('${kind}',[^\\n]+${requiredEffects}`, 'i'),
      );
    }
  });

  it('stores frozen execution data only in the protected private schema', () => {
    expect(foundation).toMatch(/create schema if not exists private/i);
    expect(foundation).toMatch(/create table private\.background_job_payloads/i);
    expect(foundation).toMatch(/background_job_payloads_immutable_trigger/i);
    expect(foundation).toMatch(/alter table private\.background_job_payloads enable row level security/i);
    expect(foundation).toMatch(/revoke all on schema private from public, anon, authenticated, service_role/i);
    expect(foundation).toMatch(
      /revoke all on table private\.background_job_payloads from public, anon, authenticated, service_role/i,
    );
    expect(allMigrations).not.toMatch(/grant [^;]*background_job_payloads/i);
    expect(reconciliation).not.toMatch(/background_job_payloads/i);
  });

  it('keeps PostgreSQL regex repetition bounds valid and provider keys globally unique', () => {
    const invalidBounds = Array.from(allMigrations.matchAll(/\{(\d+),(\d+)\}/g))
      .map((match) => ({ source: match[0], maximum: Number(match[2]) }))
      .filter(({ maximum }) => maximum > 255);
    expect(invalidBounds).toEqual([]);
    expect(foundation).toMatch(/background_job_effects_provider_idempotency_unique/i);
    expect(foundation).toMatch(/provider_name, provider_idempotency_key/i);
  });

  it('makes enqueue atomic and duplicate intents input-stable', () => {
    const core = enqueueAndClaim.match(
      /create or replace function private\.background_job_enqueue_core[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(core).toBeTruthy();
    expect(core).toMatch(/insert into public\.background_jobs/i);
    expect(core).toMatch(/insert into private\.background_job_payloads/i);
    expect(core).toMatch(/private\.background_job_send_message/i);
    expect(core).toMatch(/pg_advisory_xact_lock\(\s*hashtextextended\(p_kind \|\| ':' \|\| p_intent_key, 0\)/i);
    expect(core).toMatch(/v_payload_hash := encode\(sha256\(convert_to\(p_payload::text, 'UTF8'\)\), 'hex'\)/i);
    expect(core).not.toMatch(/p_input_hash/i);
    expect(core).toMatch(/v_job\.project_id is distinct from p_project_id/i);
    expect(core).toMatch(/intent key already exists with different frozen input/i);
    expect(core).toMatch(/duplicate_enqueue/i);
    expect(enqueueAndClaim).toMatch(/background_job_enqueue_staff/i);
    expect(enqueueAndClaim).toMatch(/background_job_enqueue_system/i);
  });

  it('fences every worker mutation with a random per-claim lease token', () => {
    const claim = enqueueAndClaim.match(
      /create or replace function public\.background_jobs_claim[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(claim).toMatch(/lease_token = gen_random_uuid\(\)/i);
    expect(claim).toMatch(/when claimed_job\.status in \('provider_accepted', 'finalising'\)/i);
    expect(claim).toMatch(/then claimed_job\.current_phase/i);
    expect(claim).not.toMatch(/when status in \('provider_accepted', 'finalising'\)/i);
    expect(enqueueAndClaim).toMatch(
      /background_job_read_payload\(\s*p_job_id uuid,\s*p_worker_id text,\s*p_lease_token uuid/i,
    );
    expect(enqueueAndClaim).toMatch(
      /background_job_heartbeat\(\s*p_job_id uuid,\s*p_worker_id text,\s*p_lease_token uuid/i,
    );

    for (const rpc of [
      'background_job_record_progress',
      'background_job_record_effect_checkpoint',
      'background_job_complete',
      'background_job_schedule_retry',
      'background_job_mark_needs_attention',
      'background_job_mark_permanent_failure',
      'background_job_acknowledge_cancellation',
      'background_job_release_lease',
    ]) {
      expect(lifecycle, rpc).toMatch(
        new RegExp(`${rpc}\\(\\s*p_job_id uuid,\\s*p_worker_id text,\\s*p_lease_token uuid`, 'i'),
      );
    }
  });

  it('has strict transitions, effect checkpoints, terminal archive, retry, cancellation, and repair RPCs', () => {
    expect(foundation).toMatch(/invalid background-job transition/i);
    expect(foundation).toMatch(/invalid background-job effect transition/i);
    expect(lifecycle).toMatch(/background_job_record_effect_checkpoint/i);
    expect(lifecycle).toMatch(/background_job_archive_canonical/i);
    expect(lifecycle).toMatch(/background_job_schedule_retry/i);
    expect(lifecycle).toMatch(/started provider dispatch must be checkpointed failed or uncertain before retry/i);
    expect(lifecycle).toMatch(/provider uncertainty must stay inside its idempotency window for automatic retry/i);
    expect(lifecycle).toMatch(/now\(\) \+ make_interval\(secs => p_delay_seconds\)/i);
    expect(lifecycle).toMatch(/provider dispatch requires frozen identity and a live idempotency window/i);
    expect(lifecycle).toMatch(/cancellation must be acknowledged before provider dispatch/i);
    expect(lifecycle).toMatch(/provider_message_id is distinct from p_provider_message_id/i);
    expect(lifecycle).toMatch(/unnest\(job_kind\.required_effect_kinds\)/i);
    expect(lifecycle).toMatch(/v_job\.execution_owner <> 'shadow'/i);
    expect(lifecycle).toMatch(/required external effect % must be finalised before job completion/i);
    expect(lifecycle).toMatch(/v_previous_job_status,[\s\S]*?v_job\.status/i);
    expect(foundation).toMatch(/when 'uncertain' then p_to in \('dispatch_started', 'provider_accepted', 'failed'\)/i);
    expect(foundation).toMatch(/when 'failed' then p_to = 'dispatch_started'/i);
    expect(lifecycle).toMatch(/background_job_request_cancellation/i);
    expect(lifecycle).toMatch(/background-job cancellation must be acknowledged before lifecycle changes/i);
    expect(lifecycle).toMatch(/background_job_manual_retry/i);
    expect(reconciliation).toMatch(/background_jobs_recover_expired_leases/i);
    expect(reconciliation).toMatch(/background_jobs_reconcile/i);
    expect(reconciliation).toMatch(/orphaned_message/i);
    expect(reconciliation).toMatch(/missing_canonical_message/i);
    expect(reconciliation).toMatch(/'queue_archive_missing'/i);
    expect(reconciliation).toMatch(/least\(p_limit, 1000\)/i);
    expect(reconciliation).toMatch(/if pgmq\.archive\('portal_background_jobs', v_message\.msg_id\) then/i);
  });

  it('fails closed on explicit null bounds and permits only FK reference redaction in event history', () => {
    expect(enqueueAndClaim).toMatch(/p_batch_size is null or p_batch_size not between 1 and 100/i);
    expect(enqueueAndClaim).toMatch(
      /p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600/i,
    );
    expect(lifecycle).toMatch(/p_delay_seconds is null or p_delay_seconds not between 1 and 72000/i);
    expect(reconciliation.match(/p_limit is null or p_limit not between/g)).toHaveLength(4);
    expect(foundation).toMatch(/to_jsonb\(new\) - array\['job_id', 'actor_user_id'\]/i);
    expect(foundation).toMatch(/background-job event history is append-only/i);
  });

  it('does not let generic phase progress bypass durable provider checkpoints', () => {
    const progress = lifecycle.match(
      /create or replace function public\.background_job_record_progress[\s\S]*?\n\$\$;/i,
    )?.[0];
    const checkpoint = lifecycle.match(
      /create or replace function public\.background_job_record_effect_checkpoint[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(progress).toBeTruthy();
    expect(checkpoint).toBeTruthy();
    expect(progress).toMatch(/p_status not in \('claimed', 'preparing', 'running', 'finalising'\)/i);
    expect(progress).not.toMatch(/p_status not in \([^)]*'dispatching'/i);
    expect(checkpoint).toMatch(/set status = 'dispatching',[\s\S]*?current_phase = 'provider_dispatch'/i);
  });

  it('keeps queue, ledger, event, effect, worker, and payload access off browser roles', () => {
    for (const table of [
      'background_job_kinds',
      'background_jobs',
      'background_job_effects',
      'background_job_events',
      'background_workers',
    ]) {
      expect(foundation, table).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
      expect(foundation, table).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'),
      );
    }
    expect(foundation).toMatch(/revoke all on schema pgmq from public, anon, authenticated, service_role/i);
    expect(foundation).toMatch(
      /revoke all on all functions in schema pgmq from public, anon, authenticated, service_role/i,
    );
    expect(allMigrations).not.toMatch(/grant execute[^;]*to (?:public|anon|authenticated)/i);
    expect(allMigrations).not.toMatch(
      /grant (?:select|insert|update|delete|all)[^;]*to (?:public|anon|authenticated)/i,
    );
    expect(reconciliation).toMatch(/background_job_get_safe/i);
    expect(reconciliation).toMatch(/background_job_event_history_safe/i);
  });

  it('ships executable isolated-database assertions in addition to static migration checks', () => {
    const sqlTest = readFileSync(path.join(process.cwd(), 'supabase/tests/background_jobs.sql'), 'utf8');
    const databaseHarness = readFileSync(path.join(process.cwd(), 'scripts/test-background-jobs-db.mjs'), 'utf8');
    expect(sqlTest).toMatch(/relpersistence = 'p'/i);
    expect(sqlTest).toMatch(/relation\.relrowsecurity/i);
    expect(sqlTest).toMatch(/background_job_enqueue_system/i);
    expect(sqlTest).toMatch(/background_jobs_claim/i);
    expect(sqlTest).toMatch(/background_job_heartbeat/i);
    expect(sqlTest).toMatch(/pg_get_functiondef/i);
    expect(sqlTest).toMatch(/background_job_record_effect_checkpoint/i);
    expect(sqlTest).toMatch(/'email_dispatch',\s*'email_dispatch',\s*'finalised'/i);
    expect(sqlTest).not.toMatch(/'email_dispatch',\s*'provider_email'/i);
    expect(sqlTest).toMatch(/background_job_request_cancellation/i);
    expect(sqlTest).toMatch(/claimed cancellation allowed retry scheduling/i);
    expect(sqlTest).toMatch(/claimed cancellation allowed lease release instead of acknowledgement/i);
    expect(sqlTest).toMatch(/shadow execution started an external provider dispatch/i);
    expect(sqlTest).toMatch(/background_jobs_recover_expired_leases/i);
    expect(sqlTest).toMatch(/background_jobs_reconcile/i);
    expect(sqlTest).toMatch(/queue_archive_missing/i);
    expect(sqlTest).toMatch(/NULL reconciliation limit bypassed bounds/i);
    expect(sqlTest).toMatch(/sql-upper-bound', 5000/i);
    expect(sqlTest).toMatch(/frozen provider message ID was silently replaced/i);
    expect(sqlTest).toMatch(/event content update bypassed append-only history/i);
    expect(sqlTest).toMatch(/background_job_complete/i);
    expect(sqlTest).toMatch(/rollback;/i);
    expect(databaseHarness).toMatch(/Promise\.all\(\[clientA, clientB\]\)/i);
    expect(databaseHarness).toMatch(/p_priority => 100::smallint/i);
    expect(databaseHarness).toMatch(/LEDGER_COUNT=/i);
  });
});
