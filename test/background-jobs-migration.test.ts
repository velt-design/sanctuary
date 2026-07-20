import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_JOB_EFFECT_STATES,
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODES,
  BACKGROUND_JOB_ROLLOUT_MODES,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  getBackgroundJobDefinition,
} from '@sp/jobs';

const migrationNames = [
  '20260720_000001_background_job_foundation.sql',
  '20260720_000002_background_job_enqueue_claim.sql',
  '20260720_000003_background_job_lifecycle.sql',
  '20260720_000004_background_job_reconciliation.sql',
  '20260720_000005_background_job_contract_hardening.sql',
  '20260720_000006_background_job_worker_runtime.sql',
  '20260720_000007_background_job_provider_reconciliation.sql',
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
const workerRuntime = migration(migrationNames[5]);
const providerReconciliation = migration(migrationNames[6]);
const allMigrations = migrationNames.map(migration).join('\n');
const effectiveLifecycle = [
  enqueueAndClaim,
  initialLifecycle,
  contractHardening,
  providerReconciliation,
].join('\n');
const executableSqlContract = readFileSync(
  path.join(process.cwd(), 'supabase/tests/background_jobs.sql'),
  'utf8',
);
const databaseBootstrap = readFileSync(
  path.join(process.cwd(), 'supabase/tests/background_jobs_bootstrap.sql'),
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
      'background_job_record_provider_acceptance',
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
      /count\(\*\) filter \(where effect\.state = 'dispatch_started'\)/i,
    );
    expect(retry).toMatch(/v_dispatch_outcome_count <> 1/i);
    expect(retry).toMatch(
      /set state = 'uncertain'[\s\S]*?state = 'dispatch_started'/i,
    );
    expect(retry).toMatch(
      /retry-exhausted provider uncertainty must move to needs attention/i,
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

  it('stores only append-only minimal verified-provider receipts behind the private RPC boundary', () => {
    const receiptTable = providerReconciliation.match(
      /create table private\.background_job_provider_receipts[\s\S]*?\n\);/i,
    )?.[0];
    expect(receiptTable).toBeTruthy();
    expect(receiptTable).toMatch(/unique \(provider_name, provider_event_id\)/i);
    expect(receiptTable).toMatch(/provider_name = 'resend'/i);
    expect(receiptTable).toMatch(/provider_event_type = 'email\.sent'/i);
    expect(receiptTable).toMatch(
      /tagged_effect_ref[\s\S]*?\^\[0-9a-f\]\{64\}/i,
    );
    expect(receiptTable).not.toMatch(/recipient|subject|html|body|signature|raw_payload|arbitrary_tags/i);
    expect(providerReconciliation).toMatch(
      /alter table private\.background_job_provider_receipts enable row level security/i,
    );
    expect(providerReconciliation).toMatch(
      /background_job_provider_receipts_append_only_trigger/i,
    );
    expect(providerReconciliation).toMatch(
      /revoke all on table private\.background_job_provider_receipts[\s\S]*?public, anon, authenticated, service_role/i,
    );
    expect(providerReconciliation).toMatch(
      /revoke all on sequence private\.background_job_provider_receipts_id_seq[\s\S]*?public, anon, authenticated, service_role/i,
    );
  });

  it('reconciles verified Resend acceptance atomically without trusting webhook tags alone', () => {
    const reconcileAcceptance = latestFunctionDefinition(
      providerReconciliation,
      'public.background_job_reconcile_verified_provider_acceptance',
    );
    const effectRef = latestFunctionDefinition(
      providerReconciliation,
      'private.background_job_provider_effect_ref',
    );

    expect(effectRef).toContain('sanctuary:provider-effect:v1|');
    expect(effectRef).toMatch(/sha256\(convert_to\(/i);
    expect(reconcileAcceptance).toMatch(/p_provider_name is distinct from 'resend'/i);
    expect(reconcileAcceptance).toMatch(/p_provider_event_type is distinct from 'email\.sent'/i);
    expect(reconcileAcceptance).toMatch(/pg_advisory_xact_lock/i);
    expect(reconcileAcceptance).toMatch(
      /provider event identity was reused with different content/i,
    );
    expect(reconcileAcceptance).toMatch(
      /private\.background_job_provider_effect_ref\([\s\S]*?\) = p_tagged_effect_ref/i,
    );
    expect(reconcileAcceptance).toMatch(
      /v_effect\.state in \('dispatch_started', 'uncertain', 'failed'\)/i,
    );
    expect(reconcileAcceptance).toMatch(
      /v_effect\.state in \('dispatch_started', 'uncertain', 'failed'\)[\s\S]*?and v_job\.status in \([\s\S]*?'needs_attention'[\s\S]*?\) then[\s\S]*?set state = 'provider_accepted'/i,
    );
    expect(reconcileAcceptance).toMatch(
      /v_effect\.state = 'finalised'[\s\S]*?v_job\.status in \([\s\S]*?'provider_accepted'[\s\S]*?'finalising'[\s\S]*?'succeeded'[\s\S]*?'needs_attention'/i,
    );
    expect(reconcileAcceptance).toMatch(
      /set state = 'provider_accepted',[\s\S]*?provider_message_id = p_provider_message_id/i,
    );
    expect(reconcileAcceptance).toMatch(
      /'effectKind', 'email_dispatch',[\s\S]*?'checkpoint', 'provider_accepted',[\s\S]*?'providerName', 'resend',[\s\S]*?'providerAccepted', true/i,
    );
    expect(reconcileAcceptance).toMatch(
      /v_live_lease :=[\s\S]*?v_job\.lease_expires_at > now\(\)/i,
    );
    expect(reconcileAcceptance).toMatch(
      /if not v_live_lease then[\s\S]*?private\.background_job_set_visibility_or_repair\(/i,
    );
    expect(reconcileAcceptance).toMatch(/completed_at = null/i);
    expect(reconcileAcceptance).toMatch(
      /insert into private\.background_job_provider_receipts/i,
    );
    expect(reconcileAcceptance).toMatch(
      /if v_job\.status not in \('needs_attention', 'permanent_failed'\) then[\s\S]*?set status = 'needs_attention',[\s\S]*?error_code = 'PROVIDER_WEBHOOK_CONFLICT'/i,
    );
    expect(providerReconciliation).toMatch(
      /background_job_effects_resend_idempotency_window_bounded[\s\S]*?created_at \+ interval '24 hours'/i,
    );
    expect(
      latestFunctionDefinition(
        providerReconciliation,
        'public.background_job_effect_transition_allowed',
      ),
    ).toMatch(/when 'failed' then p_to in \('dispatch_started', 'provider_accepted'\)/i);
    expect(providerReconciliation).toMatch(
      /revoke all on function public\.background_job_reconcile_verified_provider_acceptance\([\s\S]*?service_role;[\s\S]*?grant execute on function public\.background_job_reconcile_verified_provider_acceptance\([\s\S]*?to service_role/i,
    );
    expect(providerReconciliation).not.toMatch(
      /grant execute[^;]*background_job_reconcile_verified_provider_acceptance[^;]*to (?:public|anon|authenticated)/i,
    );
    for (const signature of [
      'background_job_record_provider_acceptance\\(\\s*uuid,\\s*text,\\s*uuid,\\s*text,\\s*text,\\s*text,\\s*text,\\s*text,\\s*timestamptz,\\s*text,\\s*jsonb\\s*\\)',
      'background_job_schedule_retry\\(uuid, text, uuid, integer, text, text\\)',
      'background_job_mark_permanent_failure\\(uuid, text, uuid, text, text\\)',
      'background_jobs_recover_expired_leases\\(text, integer\\)',
      'background_jobs_claim\\(text, integer, integer\\)',
    ]) {
      expect(providerReconciliation).toMatch(
        new RegExp(
          `revoke all on function public\\.${signature}[\\s\\S]*?service_role;[\\s\\S]*?grant execute on function public\\.${signature}[\\s\\S]*?to service_role`,
          'i',
        ),
      );
    }
  });

  it('atomically quarantines a conflicting local provider acceptance under the worker lease', () => {
    const recordAcceptance = latestFunctionDefinition(
      providerReconciliation,
      'public.background_job_record_provider_acceptance',
    );

    expect(recordAcceptance).toMatch(
      /public\.background_job_record_effect_checkpoint\([\s\S]*?'provider_accepted'/i,
    );
    expect(recordAcceptance.indexOf('v_job := private.background_job_lock_owned'))
      .toBeLessThan(recordAcceptance.indexOf('from public.background_job_record_effect_checkpoint'));
    expect(recordAcceptance).toMatch(/exception when unique_violation/i);
    expect(recordAcceptance).toMatch(/private\.background_job_lock_owned\(/i);
    expect(recordAcceptance).toMatch(
      /v_effect\.effect_key <> p_effect_key[\s\S]*?v_effect\.payload_hash <> p_payload_hash[\s\S]*?v_effect\.provider_name is distinct from p_provider_name[\s\S]*?v_effect\.provider_idempotency_key is distinct from p_provider_idempotency_key[\s\S]*?v_effect\.provider_idempotency_expires_at is distinct from p_provider_idempotency_expires_at/i,
    );
    expect(recordAcceptance).toMatch(
      /v_effect\.state in \('provider_accepted', 'finalised'\)[\s\S]*?v_effect\.provider_message_id <> p_provider_message_id[\s\S]*?v_conflict_reason := 'provider_message_id_conflict'/i,
    );
    expect(recordAcceptance).toMatch(
      /v_effect\.state in \('dispatch_started', 'uncertain', 'failed'\)[\s\S]*?other_effect\.provider_message_id = p_provider_message_id[\s\S]*?v_conflict_reason := 'provider_message_id_collision'/i,
    );
    expect(recordAcceptance).toMatch(
      /v_effect\.state = 'dispatch_started'[\s\S]*?set state = 'uncertain'/i,
    );
    expect(recordAcceptance).toMatch(
      /private\.background_job_archive_canonical\([\s\S]*?set status = 'needs_attention',[\s\S]*?error_code = 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',[\s\S]*?lease_owner = null,[\s\S]*?lease_token = null/i,
    );
    expect(recordAcceptance).toMatch(
      /private\.background_job_insert_event\([\s\S]*?'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'[\s\S]*?return v_effect/i,
    );
    expect(providerReconciliation).toMatch(
      /revoke all on function public\.background_job_record_provider_acceptance\([\s\S]*?service_role;[\s\S]*?grant execute on function public\.background_job_record_provider_acceptance\([\s\S]*?to service_role/i,
    );
    expect(providerReconciliation).not.toMatch(
      /grant execute[^;]*background_job_record_provider_acceptance[^;]*to (?:public|anon|authenticated)/i,
    );
  });

  it('autonomously retries lost provider responses only under the frozen live identity', () => {
    const recoverExpired = latestFunctionDefinition(
      providerReconciliation,
      'public.background_jobs_recover_expired_leases',
    );
    const claim = latestFunctionDefinition(
      providerReconciliation,
      'public.background_jobs_claim',
    );

    for (const definition of [recoverExpired, claim]) {
      expect(definition).toMatch(
        /set state = 'uncertain'[\s\S]*?state = 'dispatch_started'/i,
      );
      expect(definition).toMatch(
        /update public\.background_job_effects as effect[\s\S]*?where effect\.job_id = v_job\.id[\s\S]*?effect\.state = 'dispatch_started'/i,
      );
      expect(definition).toMatch(
        /count\(\*\) filter \(where effect\.state in \('dispatch_started', 'uncertain'\)\)/i,
      );
      expect(definition).toMatch(
        /v_dispatch_effect_count <> 1 or v_dispatch_outcome_count <> 1/i,
      );
      expect(definition).toMatch(/PROVIDER_EFFECT_INVARIANT/i);
      expect(definition).toMatch(
        /effect\.state in \('prepared', 'failed', 'uncertain'\)[\s\S]*?provider_idempotency_expires_at <= now\(\)/i,
      );
      expect(definition).toMatch(
        /v_job\.attempt_count >= v_job\.max_attempts[\s\S]*?effect\.state = 'uncertain'/i,
      );
      expect(definition).toMatch(/status = 'retrying'/i);
      expect(definition).toMatch(
        /current_phase = (?:'provider_retry'|case when v_previous_status = 'dispatching'[\s\S]*?then 'provider_retry')/i,
      );
      expect(definition).toMatch(/PROVIDER_OUTCOME_UNCERTAIN/i);
    }

    expect(recoverExpired).toMatch(
      /private\.background_job_set_visibility_or_repair\([\s\S]*?'provider_uncertainty_recovery'/i,
    );
    expect(claim).toMatch(
      /from pgmq\.read\('portal_background_jobs', p_visibility_timeout_seconds, p_batch_size\)/i,
    );
    expect(claim).not.toMatch(
      /if v_previous_status = 'dispatching' then[\s\S]{0,900}?error_code = 'LEASE_EXPIRED_DURING_DISPATCH'/i,
    );
  });

  it('prevents a terminal worker write from overwriting verified provider acceptance', () => {
    const acceptanceWins = latestFunctionDefinition(
      providerReconciliation,
      'private.background_job_provider_acceptance_wins',
    );
    const markNeedsAttention = latestFunctionDefinition(
      providerReconciliation,
      'public.background_job_mark_needs_attention',
    );
    const markPermanentFailure = latestFunctionDefinition(
      providerReconciliation,
      'public.background_job_mark_permanent_failure',
    );
    const reconcileAcceptance = latestFunctionDefinition(
      providerReconciliation,
      'public.background_job_reconcile_verified_provider_acceptance',
    );

    const sqlErrorCodes = Array.from(
      acceptanceWins.matchAll(/'([A-Z][A-Z0-9_]+)'/g),
      (match) => match[1],
    );
    expect(sqlErrorCodes).toEqual([
      ...BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODES,
    ]);
    expect(providerReconciliation).toMatch(
      /revoke all on function private\.background_job_provider_acceptance_wins\(text\)[\s\S]*?public, anon, authenticated, service_role/i,
    );

    expect(markNeedsAttention).toMatch(
      /private\.background_job_provider_acceptance_wins\(p_error_code\)[\s\S]*?effect\.state in \('provider_accepted', 'finalised'\)/i,
    );
    expect(markNeedsAttention).toMatch(
      /provider-accepted work must resume finalisation, not needs attention/i,
    );
    expect(markNeedsAttention).toMatch(/errcode = '40001'/i);
    expect(markNeedsAttention.indexOf("effect.state in ('provider_accepted', 'finalised')"))
      .toBeLessThan(markNeedsAttention.indexOf("set status = 'needs_attention'"));
    expect(markNeedsAttention).not.toMatch(/if v_job\.status = 'needs_attention'[\s\S]*?return v_job/i);
    expect(markNeedsAttention.indexOf('private.background_job_lock_owned'))
      .toBeLessThan(markNeedsAttention.indexOf("set status = 'needs_attention'"));

    expect(markPermanentFailure).not.toMatch(
      /if v_job\.status = 'permanent_failed'[\s\S]*?return v_job/i,
    );
    expect(markPermanentFailure).toMatch(
      /private\.background_job_lock_owned\([\s\S]*?private\.background_job_provider_acceptance_wins\(p_error_code\)[\s\S]*?effect\.state in \('provider_accepted', 'finalised'\)[\s\S]*?errcode = '40001'/i,
    );
    expect(markPermanentFailure.indexOf('private.background_job_lock_owned'))
      .toBeLessThan(markPermanentFailure.indexOf("set status = 'permanent_failed'"));

    expect(reconcileAcceptance).toMatch(
      /v_job\.status not in \('needs_attention', 'permanent_failed'\)[\s\S]*?private\.background_job_provider_acceptance_wins\(v_job\.error_code\)/i,
    );
    expect(reconcileAcceptance).toMatch(
      /v_effect\.state = 'provider_accepted'[\s\S]*?v_job\.status in \([\s\S]*?'provider_accepted'[\s\S]*?'finalising'[\s\S]*?'needs_attention'[\s\S]*?'permanent_failed'/i,
    );
  });

  it('keeps direct uncertain-state recovery metadata canonical and auditable', () => {
    const uncertainUpdates = Array.from(
      providerReconciliation.matchAll(
        /set state = 'uncertain',([\s\S]*?updated_at = now\(\))/gi,
      ),
      (match) => match[1],
    );

    expect(uncertainUpdates).toHaveLength(7);
    for (const update of uncertainUpdates) {
      expect(update).toMatch(
        /safe_metadata = jsonb_build_object\([\s\S]*?'effectKind', (?:effect\.)?effect_kind,[\s\S]*?'checkpoint', 'uncertain',[\s\S]*?'providerName', (?:effect\.)?provider_name/i,
      );
      expect(update).toMatch(/updated_at = now\(\)/i);
    }
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
    for (const helper of [
      'background_job_transition_allowed',
      'background_job_effect_transition_allowed',
      'background_job_effect_kind_array_valid',
      'background_jobs_before_update',
      'background_job_effects_before_update',
      'background_job_events_append_only',
    ]) {
      expect(contractHardening).toMatch(
        new RegExp(`revoke all on function public\\.${helper}\\([\\s\\S]*?from service_role`, 'i'),
      );
    }
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
      /same-key recovered dispatch did not re-enter dispatching/i,
    );
    expect(executableSqlContract).toMatch(
      /background_job_reconcile_verified_provider_acceptance/i,
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
    expect(databaseHarness).toMatch(/pg_isready[\s\S]*--host=127\.0\.0\.1/i);
    expect(databaseHarness).toMatch(/BACKGROUND_JOBS_DB_READY_STABLE_MS/i);
    expect(databaseBootstrap).toMatch(/to_regclass\('auth\.users'\) is null/i);
    expect(databaseHarness).toMatch(/p_priority => 100::smallint/i);
    expect(databaseHarness).toMatch(/LEDGER_COUNT=/i);
    expect(databaseHarness).toMatch(/wait_event = 'transactionid'/i);
    expect(databaseHarness).toMatch(/pg_blocking_pids\(blocked\.pid\)/i);
    expect(databaseHarness).toMatch(
      /concurrent provider-message collision contract passed/i,
    );
    expect(databaseHarness).toMatch(
      /await verifyConcurrentProviderMessageCollision\(\)/i,
    );
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
      'lost provider outcome checkpoint did not schedule an atomic same-key retry',
      'same-key cooperative retry was not reclaimable with its frozen identity',
      'missing dispatch checkpoint was accepted for cooperative retry',
      'missing dispatch checkpoint retry rejection was not atomic',
      'multiple dispatch checkpoints were accepted for cooperative retry',
      'multiple dispatch checkpoint retry rejection was not atomic',
      'expired dispatch identity was accepted for cooperative retry',
      'expired dispatch identity retry rejection was not atomic',
      'exhausted dispatch was accepted for cooperative retry',
      'exhausted dispatch retry rejection was not atomic',
      'verified provider acceptance did not preserve the live lease with exact canonical metadata',
      'verified provider acceptance did not append its minimal matched receipt',
      'exact duplicate provider event was not idempotent',
      'provider event ID reuse accepted changed event content',
      'changed duplicate provider event mutated the accepted effect',
      'verified acceptance after provider expiry did not atomically reactivate finalisation',
      'provider-accepted repair message did not resume finalisation',
      'provider acceptance queue failure did not roll back the full reconciliation transaction',
      'provider acceptance could not retry after transactional queue-repair rollback',
      'provider message collision was not retained as a fenced reconciliation conflict',
      'unmatched verified provider event was not retained minimally',
      'provider receipt update bypassed append-only history',
      'provider receipt delete bypassed append-only history',
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
      'service role read provider receipts directly',
      'service role read PGMQ directly',
    ]) {
      expect(executableSqlContract, `role matrix: ${marker}`).toContain(marker);
    }
  });

  it('adds lease-fenced worker context and aggregate-only runtime health projections', () => {
    const runtimeMetrics = latestFunctionDefinition(
      workerRuntime,
      'public.background_jobs_runtime_metrics',
    );
    const executableRuntimeContract = executableSqlContract.slice(
      executableSqlContract.indexOf('-- JOB-02 runtime reads'),
      executableSqlContract.indexOf('-- Explicit NULLs fail closed'),
    );

    expect(workerRuntime).toMatch(/background_job_read_runtime_context/i);
    expect(workerRuntime).toMatch(/job\.lease_token = p_lease_token/i);
    expect(workerRuntime).toMatch(/job\.lease_expires_at > now\(\)/i);
    expect(workerRuntime).toMatch(/background_jobs_runtime_metrics/i);
    expect(workerRuntime).toMatch(/oldest_job_age_seconds/i);
    expect(workerRuntime).toMatch(/status_counts jsonb/i);
    expect(workerRuntime).toMatch(/kind_counts jsonb/i);
    expect(workerRuntime).toMatch(/worker_lifecycle_counts jsonb/i);
    expect(returnedTableColumns(runtimeMetrics)).toEqual([
      'queue_depth',
      'oldest_message_age_seconds',
      'oldest_job_age_seconds',
      'due_jobs',
      'next_due_at',
      'status_counts',
      'kind_counts',
      'worker_lifecycle_counts',
      'stale_workers',
      'measured_at',
    ]);
    for (const lifecycleState of BACKGROUND_JOB_WORKER_LIFECYCLE_STATES) {
      expect(runtimeMetrics).toContain(`'${lifecycleState}'`);
    }
    expect(workerRuntime).toMatch(/background_workers_list_safe/i);
    expect(workerRuntime).not.toMatch(/grant execute[\s\S]*to (?:public|anon|authenticated)/i);
    for (const signature of [
      'background_job_read_runtime_context\\(uuid, text, uuid\\)',
      'background_jobs_runtime_metrics\\(\\)',
      'background_workers_list_safe\\(integer\\)',
    ]) {
      expect(workerRuntime).toMatch(
        new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?service_role`, 'i'),
      );
      expect(workerRuntime).toMatch(
        new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to service_role`, 'i'),
      );
    }

    expect(executableRuntimeContract).toMatch(
      /set local role service_role;[\s\S]*service-role lease-fenced worker runtime context was incomplete[\s\S]*service-role safe worker health projection was incomplete[\s\S]*service-role runtime aggregate metrics were incomplete[\s\S]*reset role;/i,
    );
    expect(executableSqlContract).toMatch(
      /has_function_privilege\('authenticated', routine\.oid, 'execute'\)/i,
    );
    expect(executableSqlContract).toContain('browser role can execute a background-job function');
    expect(executableRuntimeContract).not.toMatch(/set local role authenticated/i);
    expect(executableRuntimeContract).toContain('supabase/postgres#2112');
  });
});
