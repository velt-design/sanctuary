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
  '20260720_000005_background_job_contract_hardening.sql',
] as const;

function migration(name: (typeof migrationNames)[number]): string {
  return readFileSync(
    path.join(process.cwd(), 'supabase/migrations', name),
    'utf8',
  );
}

const foundation = migration(migrationNames[0]);
const enqueueAndClaim = migration(migrationNames[1]);
const initialLifecycle = migration(migrationNames[2]);
const reconciliation = migration(migrationNames[3]);
const contractHardening = migration(migrationNames[4]);
const allMigrations = migrationNames.map(migration).join('\n');
const effectiveLifecycle = [
  enqueueAndClaim,
  initialLifecycle,
  contractHardening,
].join('\n');
const executableSqlContract = readFileSync(
  path.join(process.cwd(), 'supabase/tests/background_jobs.sql'),
  'utf8',
);
const databaseHarness = readFileSync(
  path.join(process.cwd(), 'scripts/test-background-jobs-db.mjs'),
  'utf8',
);

function enumValues(source: string, enumName: string): string[] {
  const block =
    source.match(
      new RegExp(
        `create type public\\.${enumName} as enum \\(([\\s\\S]*?)\\);`,
        'i',
      ),
    )?.[1] ?? '';
  return Array.from(block.matchAll(/'([^']+)'/g), (match) => match[1]);
}

function latestFunctionDefinition(
  source: string,
  qualifiedName: string,
): string {
  const escapedName = qualifiedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definitions = Array.from(
    source.matchAll(
      new RegExp(
        `create(?: or replace)? function\\s+${escapedName}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
        'gi',
      ),
    ),
    (match) => match[0],
  );
  const definition = definitions.at(-1);
  if (!definition)
    throw new Error(`Missing SQL function definition for ${qualifiedName}`);
  return definition;
}

function returnedTableColumns(definition: string): string[] {
  const block = definition.match(
    /returns table\s*\(([\s\S]*?)\)\s*language/i,
  )?.[1];
  if (!block) throw new Error('Expected a RETURNS TABLE function definition');
  return block.split(',').map((column) => column.trim().split(/\s+/)[0]);
}

describe('Wave 3 background-job migrations', () => {
  it('creates one logged PGMQ queue with the exact minimal message contract', () => {
    expect(foundation).toMatch(/pgmq\.create\('portal_background_jobs'\)/i);
    expect(foundation).toMatch(/queue\.is_unlogged/i);
    expect(foundation).toMatch(
      /portal_background_jobs must be a logged queue/i,
    );
    expect(allMigrations).not.toMatch(/create_unlogged/i);
    const sendMessageBody = enqueueAndClaim.match(
      /create or replace function private\.background_job_send_message[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(sendMessageBody).toBeTruthy();
    expect(sendMessageBody).toMatch(
      /jsonb_build_object\(\s*'jobId', p_job_id,\s*'contractVersion', p_contract_version\s*\)/i,
    );
    expect(sendMessageBody).not.toMatch(
      /email|recipient|token|attachment|payload|customer/i,
    );
  });

  it('keeps TypeScript and database status, effect, rollout, and kind registries aligned', () => {
    expect(enumValues(foundation, 'background_job_status')).toEqual(
      BACKGROUND_JOB_STATUSES,
    );
    expect(enumValues(foundation, 'background_job_effect_state')).toEqual(
      BACKGROUND_JOB_EFFECT_STATES,
    );
    expect(enumValues(foundation, 'background_job_rollout_mode')).toEqual(
      BACKGROUND_JOB_ROLLOUT_MODES,
    );

    const seededKinds = Array.from(
      foundation.matchAll(/\('([a-z][a-z0-9_]+)',\s*1,\s*'[a-z0-9-]+'/g),
      (match) => match[1],
    );
    expect(seededKinds).toEqual(BACKGROUND_JOB_KINDS);

    for (const kind of BACKGROUND_JOB_KINDS) {
      const definition = getBackgroundJobDefinition(kind, 1);
      const requiredEffects = definition.requiredEffectCheckpoints.length
        ? `array\\['${definition.requiredEffectCheckpoints.join("', '")}']`
        : 'array\\[\\]::text\\[\\]';
      expect(foundation, `${kind} required external effects`).toMatch(
        new RegExp(`\\('${kind}',[^\\n]+${requiredEffects}`, 'i'),
      );
      expect(
        definition.allowedEffectCheckpoints,
        `${kind} allowed external effects`,
      ).toEqual(definition.requiredEffectCheckpoints);
    }

    expect(contractHardening).toMatch(
      /set allowed_effect_kinds = required_effect_kinds/i,
    );
    expect(contractHardening).toMatch(
      /required_effect_kinds <@ allowed_effect_kinds/i,
    );
    expect(contractHardening).toMatch(
      /not has_external_side_effect[\s\S]*?cardinality\(allowed_effect_kinds\) = 0[\s\S]*?cardinality\(required_effect_kinds\) = 0/i,
    );
  });

  it('freezes the accepted allowed and required effect policy on each durable job', () => {
    const freezePolicy = latestFunctionDefinition(
      contractHardening,
      'private.background_jobs_freeze_effect_policy',
    );
    const immutablePolicy = latestFunctionDefinition(
      contractHardening,
      'private.background_jobs_effect_policy_immutable',
    );
    const checkpoint = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_record_effect_checkpoint',
    );
    const complete = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_complete',
    );

    expect(contractHardening).toMatch(
      /alter table public\.background_jobs[\s\S]*?add column has_external_side_effect boolean,[\s\S]*?add column allowed_effect_kinds text\[\],[\s\S]*?add column required_effect_kinds text\[\]/i,
    );
    expect(freezePolicy).toMatch(
      /job_kind\.contract_version = new\.contract_version/i,
    );
    expect(freezePolicy).toMatch(
      /new\.has_external_side_effect := v_kind\.has_external_side_effect/i,
    );
    expect(freezePolicy).toMatch(
      /new\.allowed_effect_kinds := v_kind\.allowed_effect_kinds/i,
    );
    expect(freezePolicy).toMatch(
      /new\.required_effect_kinds := v_kind\.required_effect_kinds/i,
    );
    expect(immutablePolicy).toMatch(
      /old\.allowed_effect_kinds is distinct from new\.allowed_effect_kinds/i,
    );
    expect(immutablePolicy).toMatch(
      /old\.required_effect_kinds is distinct from new\.required_effect_kinds/i,
    );
    expect(checkpoint).toMatch(
      /p_effect_kind = any\(v_job\.allowed_effect_kinds\)/i,
    );
    expect(complete).toMatch(
      /effect\.effect_kind = any\(v_job\.allowed_effect_kinds\)/i,
    );
    expect(complete).toMatch(/unnest\(v_job\.required_effect_kinds\)/i);
    expect(complete).not.toMatch(/job_kind\.required_effect_kinds/i);
  });

  it('permits only one durable checkpoint row per job and effect kind', () => {
    const checkpoint = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_record_effect_checkpoint',
    );
    expect(contractHardening).toMatch(
      /background_job_effects_job_effect_kind_unique unique \(job_id, effect_kind\)/i,
    );
    expect(checkpoint).toMatch(
      /from public\.background_job_effects effect[\s\S]*?where effect\.job_id = p_job_id[\s\S]*?and effect\.effect_kind = p_effect_kind[\s\S]*?for update/i,
    );
    expect(checkpoint).toMatch(
      /effect checkpoint identity does not match its frozen preparation/i,
    );
  });

  it('stores frozen execution data only in the protected private schema', () => {
    expect(foundation).toMatch(/create schema if not exists private/i);
    expect(foundation).toMatch(
      /create table private\.background_job_payloads/i,
    );
    expect(foundation).toMatch(/background_job_payloads_immutable_trigger/i);
    expect(foundation).toMatch(
      /alter table private\.background_job_payloads enable row level security/i,
    );
    expect(foundation).toMatch(
      /revoke all on schema private from public, anon, authenticated, service_role/i,
    );
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
    expect(foundation).toMatch(
      /background_job_effects_provider_idempotency_unique/i,
    );
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
    expect(core).toMatch(
      /pg_advisory_xact_lock\(\s*hashtextextended\(p_kind \|\| ':' \|\| p_intent_key, 0\)/i,
    );
    expect(core).toMatch(
      /v_payload_hash := encode\(sha256\(convert_to\(p_payload::text, 'UTF8'\)\), 'hex'\)/i,
    );
    expect(core).not.toMatch(/p_input_hash/i);
    expect(core).toMatch(/v_job\.project_id is distinct from p_project_id/i);
    expect(core).toMatch(
      /intent key already exists with different frozen input/i,
    );
    expect(core).toMatch(/duplicate_enqueue/i);
    expect(enqueueAndClaim).toMatch(/background_job_enqueue_staff/i);
    expect(enqueueAndClaim).toMatch(/background_job_enqueue_system/i);
  });

  it('fences every worker mutation with a random per-claim lease token', () => {
    const claim = enqueueAndClaim.match(
      /create or replace function public\.background_jobs_claim[\s\S]*?\n\$\$;/i,
    )?.[0];
    expect(claim).toMatch(/lease_token = gen_random_uuid\(\)/i);
    expect(claim).toMatch(
      /when claimed_job\.status in \('provider_accepted', 'finalising'\)/i,
    );
    expect(claim).toMatch(/then claimed_job\.current_phase/i);
    expect(claim).not.toMatch(
      /when status in \('provider_accepted', 'finalising'\)/i,
    );
    expect(enqueueAndClaim).toMatch(
      /background_job_read_payload\(\s*p_job_id uuid,\s*p_worker_id text,\s*p_lease_token uuid/i,
    );
    expect(
      latestFunctionDefinition(
        effectiveLifecycle,
        'public.background_job_heartbeat',
      ),
    ).toMatch(
      /background_job_heartbeat\(\s*p_job_id uuid,\s*p_worker_id text,\s*p_lease_token uuid/i,
    );

    for (const rpc of [
      'background_job_record_progress',
      'background_job_record_effect_checkpoint',
      'background_job_read_effects',
      'background_job_complete',
      'background_job_schedule_retry',
      'background_job_mark_needs_attention',
      'background_job_mark_permanent_failure',
      'background_job_acknowledge_cancellation',
      'background_job_release_lease',
    ]) {
      expect(
        latestFunctionDefinition(effectiveLifecycle, `public.${rpc}`),
        rpc,
      ).toMatch(
        new RegExp(
          `${rpc}\\(\\s*p_job_id uuid,\\s*p_worker_id text,\\s*p_lease_token uuid`,
          'i',
        ),
      );
    }
  });

  it('lets only the current lease recover the frozen effect identity after restart', () => {
    const readEffects = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_read_effects',
    );

    expect(readEffects).toMatch(
      /background_job_read_effects\(\s*p_job_id uuid,\s*p_worker_id text,\s*p_lease_token uuid/i,
    );
    expect(readEffects).toMatch(/private\.background_job_lock_owned\(/i);
    expect(returnedTableColumns(readEffects)).toEqual([
      'effect_key',
      'effect_kind',
      'state',
      'payload_hash',
      'provider_name',
      'provider_idempotency_key',
      'provider_idempotency_expires_at',
      'provider_message_id',
      'safe_metadata',
    ]);
    expect(contractHardening).toMatch(
      /grant execute on function public\.background_job_read_effects\(uuid, text, uuid\) to service_role/i,
    );
    expect(contractHardening).toMatch(
      /revoke all on function public\.background_job_read_effects\(uuid, text, uuid\)[\s\S]*?from public, anon, authenticated/i,
    );
  });

  it('has strict transitions, effect checkpoints, terminal archive, retry, cancellation, and repair RPCs', () => {
    const checkpoint = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_record_effect_checkpoint',
    );
    const complete = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_complete',
    );
    const retry = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_schedule_retry',
    );
    const cancellation = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_request_cancellation',
    );
    const releaseLease = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_release_lease',
    );
    const manualRetry = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_manual_retry',
    );
    const archiveCanonical = latestFunctionDefinition(
      effectiveLifecycle,
      'private.background_job_archive_canonical',
    );
    const recoverExpired = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_recover_expired_leases',
    );
    const reconcile = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_reconcile',
    );

    expect(foundation).toMatch(/invalid background-job transition/i);
    expect(foundation).toMatch(/invalid background-job effect transition/i);
    expect(checkpoint).toMatch(
      /provider dispatch requires frozen identity and a live idempotency window/i,
    );
    expect(checkpoint).toMatch(
      /cancellation must be acknowledged before provider dispatch/i,
    );
    expect(checkpoint).toMatch(
      /provider_message_id is distinct from p_provider_message_id/i,
    );
    expect(checkpoint).toMatch(/v_previous_job_status,[\s\S]*?v_job\.status/i);
    expect(complete).toMatch(/v_job\.execution_owner <> 'shadow'/i);
    expect(complete).toMatch(
      /every recorded external effect must be finalised before job completion/i,
    );
    expect(complete).toMatch(
      /required external effect % must be finalised before job completion/i,
    );
    expect(retry).toMatch(
      /started provider dispatch must be checkpointed failed or uncertain before retry/i,
    );
    expect(retry).toMatch(
      /redispatchable provider work must stay inside its frozen idempotency window/i,
    );
    expect(retry).toMatch(
      /now\(\) \+ make_interval\(secs => p_delay_seconds\)/i,
    );
    expect(foundation).toMatch(
      /when 'uncertain' then p_to in \('dispatch_started', 'provider_accepted', 'failed'\)/i,
    );
    expect(foundation).toMatch(/when 'failed' then p_to = 'dispatch_started'/i);
    expect(releaseLease).toMatch(
      /background-job cancellation must be acknowledged before lifecycle changes/i,
    );
    expect(cancellation).toMatch(
      /cancellation_requested_at = coalesce\(cancellation_requested_at, now\(\)\)/i,
    );
    expect(cancellation).toMatch(
      /a dispatching or accepted effect cannot be cancelled safely/i,
    );
    expect(manualRetry).toMatch(/manual_retry/i);
    expect(archiveCanonical).toMatch(
      /pgmq\.archive\('portal_background_jobs', p_message_id\)/i,
    );
    expect(recoverExpired).toMatch(/lease_expired/i);
    expect(reconcile).toMatch(/orphaned_message/i);
    expect(reconcile).toMatch(/missing_canonical_message/i);
    expect(reconcile).toMatch(/'queue_archive_missing'/i);
    expect(reconcile).toMatch(/least\(p_limit, 1000\)/i);
    expect(reconcile).toMatch(
      /if pgmq\.archive\('portal_background_jobs', v_message\.msg_id\) then/i,
    );
  });

  it('fails closed on explicit null bounds and permits only FK reference redaction in event history', () => {
    const retry = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_schedule_retry',
    );
    const recoverExpired = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_recover_expired_leases',
    );
    const reconcile = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_reconcile',
    );
    const listSafe = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_list_safe',
    );
    const eventHistorySafe = latestFunctionDefinition(
      allMigrations,
      'public.background_job_event_history_safe',
    );

    expect(enqueueAndClaim).toMatch(
      /p_batch_size is null or p_batch_size not between 1 and 100/i,
    );
    expect(enqueueAndClaim).toMatch(
      /p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600/i,
    );
    expect(retry).toMatch(
      /p_delay_seconds is null or p_delay_seconds not between 1 and 72000/i,
    );
    for (const boundedFunction of [
      recoverExpired,
      reconcile,
      listSafe,
      eventHistorySafe,
    ]) {
      expect(boundedFunction).toMatch(
        /p_limit is null or p_limit not between/i,
      );
    }
    expect(foundation).toMatch(
      /to_jsonb\(new\) - array\['job_id', 'actor_user_id'\]/i,
    );
    expect(foundation).toMatch(/background-job event history is append-only/i);
  });

  it('does not let generic phase progress bypass durable provider checkpoints', () => {
    const progress = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_record_progress',
    );
    const checkpoint = latestFunctionDefinition(
      effectiveLifecycle,
      'public.background_job_record_effect_checkpoint',
    );
    expect(progress).toMatch(
      /p_status not in \('claimed', 'preparing', 'running', 'finalising'\)/i,
    );
    expect(progress).not.toMatch(/p_status not in \([^)]*'dispatching'/i);
    expect(checkpoint).toMatch(
      /set status = 'dispatching',[\s\S]*?current_phase = 'provider_dispatch'/i,
    );
  });

  it('routes provider expiry and max-attempt uncertainty inside the bounded claim loop', () => {
    const claim = latestFunctionDefinition(
      contractHardening,
      'public.background_jobs_claim',
    );

    expect(claim).toMatch(
      /from pgmq\.read\('portal_background_jobs', p_visibility_timeout_seconds, p_batch_size\)/i,
    );
    expect(claim).toMatch(
      /v_job\.attempt_count >= v_job\.max_attempts[\s\S]*?effect\.state = 'uncertain'/i,
    );
    expect(claim).toMatch(
      /effect\.state in \('prepared', 'failed', 'uncertain'\)[\s\S]*?provider_idempotency_expires_at <= now\(\)/i,
    );
    expect(claim).toMatch(/v_job\.execution_owner <> 'shadow'/i);
    expect(claim).toMatch(/'lease_expired'/i);
    expect(
      claim.indexOf("error_code = 'PROVIDER_OUTCOME_UNCERTAIN'"),
    ).toBeGreaterThanOrEqual(0);
    expect(
      claim.indexOf("error_code = 'PROVIDER_OUTCOME_UNCERTAIN'"),
    ).toBeLessThan(
      claim.indexOf(
        "if v_job.status = 'retrying' and v_job.attempt_count >= v_job.max_attempts",
      ),
    );
    expect(contractHardening).not.toMatch(/background_jobs_claim_core/i);
    expect(contractHardening).not.toMatch(/background_jobs_claim_unchecked/i);
  });

  it('uses explicit context-safe summary contracts plus value-level sensitive-data defence', () => {
    const safeString = latestFunctionDefinition(
      contractHardening,
      'private.background_job_safe_string_value',
    );
    const safeCode = latestFunctionDefinition(
      contractHardening,
      'private.background_job_safe_code',
    );
    const safeIdentifier = latestFunctionDefinition(
      contractHardening,
      'private.background_job_safe_identifier',
    );
    const safeTimestamp = latestFunctionDefinition(
      contractHardening,
      'private.background_job_safe_timestamp',
    );
    const safeSummary = latestFunctionDefinition(
      contractHardening,
      'public.background_job_safe_summary',
    );

    expect(safeSummary).toMatch(
      /p_context not in \('progress', 'result', 'effect', 'event', 'worker'\)/i,
    );
    expect(safeSummary).toMatch(/v_progress_count_keys constant text\[\]/i);
    expect(safeSummary).toMatch(/v_result_id_keys constant text\[\]/i);
    expect(safeSummary).toMatch(/v_effect_timestamp_keys constant text\[\]/i);
    expect(safeSummary).toMatch(/v_event_code_keys constant text\[\]/i);
    expect(safeSummary).toMatch(/v_worker_boolean_keys constant text\[\]/i);
    expect(safeSummary).toMatch(
      /jsonb_typeof\(v_child\) in \('object', 'null'\)/i,
    );
    expect(safeSummary).toMatch(
      /return public\.background_job_safe_json\(p_value\)/i,
    );
    expect(safeCode).toMatch(
      /private\.background_job_safe_string_value\(p_value\)/i,
    );
    expect(safeIdentifier).toMatch(/p_value ~ '\^\[A-Za-z0-9\]/i);
    expect(safeIdentifier).toMatch(/p_value ~ '\[0-9\]'/i);
    expect(safeTimestamp).toMatch(
      /perform make_date\(v_year, v_month, v_day\)/i,
    );

    for (const sensitivePattern of [
      '@[A-Z0-9.-]+',
      '://',
      '([A-Z0-9-]+\\.)+',
      'access[_-]?token',
      '(bearer|basic)',
      '-----BEGIN',
      '[0-9A-F]{32,}',
    ]) {
      expect(safeString).toContain(sensitivePattern);
    }
    for (const [context, column] of [
      ['progress', 'safe_progress'],
      ['result', 'safe_result'],
      ['effect', 'safe_metadata'],
      ['event', 'safe_detail'],
      ['worker', 'safe_metadata'],
    ]) {
      expect(contractHardening, `${context} ${column} constraint`).toMatch(
        new RegExp(
          `check \\(public\\.background_job_safe_summary\\('${context}', ${column}\\)\\)`,
          'i',
        ),
      );
    }
    for (const [qualifiedName, context] of [
      ['public.background_job_record_progress', 'progress'],
      ['public.background_job_complete', 'result'],
      ['public.background_job_record_effect_checkpoint', 'effect'],
      ['private.background_job_insert_event', 'event'],
      ['public.background_worker_heartbeat', 'worker'],
    ]) {
      expect(
        latestFunctionDefinition(allMigrations, qualifiedName),
        qualifiedName,
      ).toMatch(
        new RegExp(`public\\.background_job_safe_summary\\('${context}'`, 'i'),
      );
    }
  });

  it('repairs missing, archived, or stale queue pointers around set_vt before releasing a lease', () => {
    const visibilityRepair = latestFunctionDefinition(
      contractHardening,
      'private.background_job_set_visibility_or_repair',
    );
    expect(visibilityRepair).toMatch(
      /from pgmq\.set_vt\('portal_background_jobs', p_message_id, p_delay_seconds\) updated_message/i,
    );
    expect(visibilityRepair).toMatch(/v_message_found := found/i);
    expect(visibilityRepair).toMatch(
      /private\.background_job_queue_message_matches/i,
    );
    expect(visibilityRepair).toMatch(/private\.background_job_send_message/i);
    expect(visibilityRepair).toMatch(
      /set queue_message_id = v_replacement_message_id/i,
    );
    expect(visibilityRepair).toMatch(/'queue_archive_missing'/i);
    expect(visibilityRepair).toMatch(/'queue_repaired'/i);

    for (const rpc of [
      'public.background_job_schedule_retry',
      'public.background_job_heartbeat',
      'public.background_job_release_lease',
      'public.background_jobs_recover_expired_leases',
    ]) {
      const definition = latestFunctionDefinition(allMigrations, rpc);
      expect(definition, rpc).toMatch(
        /private\.background_job_set_visibility_or_repair/i,
      );
      expect(definition, rpc).not.toMatch(/pgmq\.set_vt/i);
    }
  });

  it('exposes explicit capability-safe projections and persists only fixed safe error copy', () => {
    const getSafe = latestFunctionDefinition(
      allMigrations,
      'public.background_job_get_safe',
    );
    const listSafe = latestFunctionDefinition(
      allMigrations,
      'public.background_jobs_list_safe',
    );
    const eventHistorySafe = latestFunctionDefinition(
      allMigrations,
      'public.background_job_event_history_safe',
    );
    const safeJobColumns = [
      'id',
      'kind',
      'contract_version',
      'subject_type',
      'subject_id',
      'project_id',
      'status',
      'current_phase',
      'priority',
      'attempt_count',
      'max_attempts',
      'next_attempt_at',
      'cancellation_requested_at',
      'rollout_mode',
      'execution_owner',
      'safe_progress',
      'safe_result',
      'error_code',
      'created_at',
      'updated_at',
      'started_at',
      'completed_at',
    ];
    expect(returnedTableColumns(getSafe)).toEqual(safeJobColumns);
    expect(returnedTableColumns(listSafe)).toEqual(safeJobColumns);
    expect(returnedTableColumns(eventHistorySafe)).toEqual([
      'id',
      'job_id',
      'event_type',
      'from_status',
      'to_status',
      'phase',
      'attempt_number',
      'error_code',
      'safe_detail',
      'created_at',
    ]);

    const safeErrorCopy = latestFunctionDefinition(
      contractHardening,
      'private.background_job_safe_error_copy',
    );
    expect(safeErrorCopy).toMatch(/when p_error_code = 'RETRY_EXHAUSTED'/i);
    expect(safeErrorCopy).toMatch(
      /when p_error_code = 'LEASE_EXPIRED_DURING_DISPATCH'/i,
    );
    expect(safeErrorCopy).toMatch(
      /when p_error_code = 'QUEUE_CONTRACT_MISMATCH'/i,
    );
    expect(safeErrorCopy).toMatch(
      /else 'The background job could not be completed\.'/i,
    );
    for (const rpc of [
      'public.background_job_schedule_retry',
      'public.background_job_mark_needs_attention',
      'public.background_job_mark_permanent_failure',
      'public.background_jobs_recover_expired_leases',
    ]) {
      const definition = latestFunctionDefinition(allMigrations, rpc);
      expect(definition, rpc).toMatch(
        /error_message = private\.background_job_safe_error_copy\(/i,
      );
      expect(definition, rpc).not.toMatch(/error_message = p_error_message/i);
    }
  });

  it('keeps queue, ledger, event, effect, worker, and payload access off browser roles', () => {
    for (const table of [
      'background_job_kinds',
      'background_jobs',
      'background_job_effects',
      'background_job_events',
      'background_workers',
    ]) {
      expect(foundation, table).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          'i',
        ),
      );
      expect(foundation, table).toMatch(
        new RegExp(
          `revoke all on table public\\.${table} from public, anon, authenticated`,
          'i',
        ),
      );
    }
    expect(foundation).toMatch(
      /revoke all on schema pgmq from public, anon, authenticated, service_role/i,
    );
    expect(foundation).toMatch(
      /revoke all on all functions in schema pgmq from public, anon, authenticated, service_role/i,
    );
    expect(allMigrations).not.toMatch(
      /grant execute[^;]*to (?:public|anon|authenticated)/i,
    );
    expect(allMigrations).not.toMatch(
      /grant (?:select|insert|update|delete|all)[^;]*to (?:public|anon|authenticated)/i,
    );
    expect(contractHardening).toMatch(
      /grant execute on function public\.background_job_get_safe\(uuid\) to service_role/i,
    );
    expect(contractHardening).toMatch(
      /grant execute on function public\.background_job_event_history_safe\(uuid, integer\) to service_role/i,
    );
  });

  it('ships executable isolated-database assertions in addition to static migration checks', () => {
    expect(executableSqlContract).toMatch(/relpersistence = 'p'/i);
    expect(executableSqlContract).toMatch(/relation\.relrowsecurity/i);
    expect(executableSqlContract).toMatch(/background_job_enqueue_system/i);
    expect(executableSqlContract).toMatch(/background_jobs_claim/i);
    expect(executableSqlContract).toMatch(/background_job_heartbeat/i);
    expect(executableSqlContract).toMatch(/pg_get_functiondef/i);
    expect(executableSqlContract).toMatch(
      /background_job_record_effect_checkpoint/i,
    );
    expect(executableSqlContract).toMatch(/background_job_read_effects/i);
    expect(executableSqlContract).toMatch(
      /'email_dispatch',\s*'email_dispatch',\s*'finalised'/i,
    );
    expect(executableSqlContract).not.toMatch(
      /'email_dispatch',\s*'provider_email'/i,
    );
    expect(executableSqlContract).toMatch(
      /background_job_request_cancellation/i,
    );
    expect(executableSqlContract).toMatch(
      /claimed cancellation allowed retry scheduling/i,
    );
    expect(executableSqlContract).toMatch(
      /claimed cancellation allowed lease release instead of acknowledgement/i,
    );
    expect(executableSqlContract).toMatch(
      /shadow execution started an external provider dispatch/i,
    );
    expect(executableSqlContract).toMatch(
      /background_jobs_recover_expired_leases/i,
    );
    expect(executableSqlContract).toMatch(/background_jobs_reconcile/i);
    expect(executableSqlContract).toMatch(/queue_archive_missing/i);
    expect(executableSqlContract).toMatch(
      /NULL reconciliation limit bypassed bounds/i,
    );
    expect(executableSqlContract).toMatch(/sql-upper-bound', 5000/i);
    expect(executableSqlContract).toMatch(
      /frozen provider message ID was silently replaced/i,
    );
    expect(executableSqlContract).toMatch(
      /event content update bypassed append-only history/i,
    );
    expect(executableSqlContract).toMatch(/background_job_complete/i);
    expect(executableSqlContract).toMatch(/rollback;/i);
    expect(databaseHarness).toMatch(/Promise\.allSettled\(\[clientA, clientB\]\)/i);
    expect(databaseHarness).toMatch(/pg_stat_clear_snapshot\(\)/i);
    expect(databaseHarness).toMatch(/wait_event_type = 'Lock'/i);
    expect(databaseHarness).toMatch(/wait_event = 'advisory'/i);
    expect(databaseHarness).toMatch(/pg_postmaster_start_time\(\)/i);
    expect(databaseHarness).toMatch(/BACKGROUND_JOBS_DB_READY_STABLE_MS/i);
    expect(databaseHarness).toMatch(/p_priority => 100::smallint/i);
    expect(databaseHarness).toMatch(/LEDGER_COUNT=/i);
  });

  it('executes release, effect-policy, safe-summary, and role/capability matrices', () => {
    for (const marker of [
      'successful lease release did not preserve a runnable canonical message',
      'duplicate lease release reused a spent token',
      'missing-message lease release did not repair atomically',
      'archived-message lease release did not create a canonical replacement',
      'stale-pointer lease release mutated the wrong message or failed exact repair',
      'later reconciliation did not retire stale release messages safely',
      'queue visibility failure did not abort lease release',
      'queue visibility failure left a partial lease release',
      'expired provider window escaped through lease release',
      'delayed claim resurrected an expired provider effect',
      'max-attempt uncertain effect was hidden as permanent failure',
      'shadow prepared effect was not reclaimable without provider identity',
    ]) {
      expect(executableSqlContract, `release matrix: ${marker}`).toContain(
        marker,
      );
    }

    for (const marker of [
      'non-side-effecting job accepted an external effect',
      'rejected non-side effect left a partial checkpoint',
      'undeclared external effect was accepted',
      'effect checkpoint skipped its prepared state',
      'exact repeated effect checkpoint was not idempotent',
      'duplicate effect kind was hidden behind a second effect key',
      'prepared effect skipped dispatch_started',
      'job completed with a recorded non-finalised effect',
      'invalid completion did not fail atomically',
      'effect snapshot accepted a stale lease token',
      'replacement worker could not recover the frozen effect identity',
      'replacement worker did not finalise the recovered effect',
    ]) {
      expect(executableSqlContract, `effect matrix: ${marker}`).toContain(
        marker,
      );
    }

    for (const marker of [
      'safe progress summary was rejected',
      'safe result summary was rejected',
      'safe effect summary was rejected',
      'safe event summary was rejected',
      'safe worker summary was rejected',
      'email value bypassed safe result validation',
      'signed URL value bypassed safe result validation',
      'raw domain URL bypassed safe result validation',
      'bearer credential bypassed safe result validation',
      'token hash bypassed safe result validation',
      'recipient array bypassed safe result validation',
      'customer name bypassed safe result validation',
      'provider payload object bypassed safe effect validation',
      'unknown safe-summary field bypassed the context allowlist',
      'invalid timestamp bypassed safe progress validation',
    ]) {
      expect(executableSqlContract, `safe-summary matrix: ${marker}`).toContain(
        marker,
      );
    }

    for (const marker of [
      'service-role background RPC allowlist mismatch',
      'browser role can execute a background-job function',
      'service role can execute a private background-job helper directly',
      'safe job inspection exposed an internal or capability field',
      'safe event inspection exposed internal correlation fields',
      'service role read the background-job ledger directly',
      'service role read protected payloads directly',
      'service role read PGMQ directly',
    ]) {
      expect(executableSqlContract, `role matrix: ${marker}`).toContain(marker);
    }
  });
});
