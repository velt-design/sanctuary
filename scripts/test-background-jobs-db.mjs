import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const defaultImage = "ghcr.io/pgmq/pg18-pgmq:v1.10.0";
const imageOverride = process.env.BACKGROUND_JOBS_DB_IMAGE?.trim();
const image = imageOverride || defaultImage;
const containerName = `sanctuary-background-jobs-${process.pid}-${Date.now()}`;
const bootstrapSqlFile = "supabase/tests/background_jobs_bootstrap.sql";
const contractSqlFile = "supabase/tests/background_jobs.sql";
const aiBootstrapSqlFile = "supabase/tests/ai_task_ledger_bootstrap.sql";
const aiTaskLedgerMigrationFile = "supabase/migrations/20260818000002_ai_task_ledger.sql";
const aiApprovalMigrationFile = "supabase/migrations/20260818000003_ai_approval_envelopes.sql";
const aiSyntheticExecutionMigrationFile = "supabase/migrations/20260818000004_ai_synthetic_execution.sql";
const aiSyntheticExecutionContractFile = "supabase/tests/ai_synthetic_execution.sql";
const migrationsDirectory = "supabase/migrations";
const waveThreeMigrationFilePattern =
  /^\d{8}_\d{6}_background_jobs?_[a-z0-9_]+\.sql$/;
const concurrentIntentKey = "sql-harness/concurrent-enqueue";
const clientAApplicationName = "sanctuary_background_jobs_client_a";
const clientBApplicationName = "sanctuary_background_jobs_client_b";
const providerCollisionIntentA = "sql-harness/provider-collision-a";
const providerCollisionIntentB = "sql-harness/provider-collision-b";
const providerCollisionWorkerA = "sql-provider-collision-a";
const providerCollisionWorkerB = "sql-provider-collision-b";
const providerCollisionClientA = "sanctuary_provider_collision_a";
const providerCollisionClientAReady = "sanctuary_provider_collision_a_ready";
const providerCollisionClientB = "sanctuary_provider_collision_b";
const providerCollisionMessageId = "resend-message-concurrent-collision";
const jobIdMarker =
  /JOB_ID=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function positiveIntegerEnvironmentValue(name, fallback) {
  const configuredValue = process.env[name]?.trim();
  if (!configuredValue) return fallback;
  if (!/^\d+$/.test(configuredValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const value = Number.parseInt(configuredValue, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function optionalEnvironmentValue(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

const readinessTimeoutMs = positiveIntegerEnvironmentValue(
  "BACKGROUND_JOBS_DB_READY_TIMEOUT_MS",
  120_000,
);
const readinessStableMs = positiveIntegerEnvironmentValue(
  "BACKGROUND_JOBS_DB_READY_STABLE_MS",
  3_000,
);
const concurrencyTimeoutMs = positiveIntegerEnvironmentValue(
  "BACKGROUND_JOBS_DB_CONCURRENCY_TIMEOUT_MS",
  30_000,
);
if (concurrencyTimeoutMs > 600_000) {
  throw new Error(
    "BACKGROUND_JOBS_DB_CONCURRENCY_TIMEOUT_MS must not exceed 600000ms.",
  );
}
const providerCollisionLeaseSeconds = Math.max(
  60,
  Math.ceil((concurrencyTimeoutMs + 30_000) / 1_000),
);
const expectedPostgresMajor = optionalEnvironmentValue(
  "BACKGROUND_JOBS_DB_EXPECTED_POSTGRES_MAJOR",
  imageOverride ? undefined : "18",
);
const expectedPgmqVersion = optionalEnvironmentValue(
  "BACKGROUND_JOBS_DB_EXPECTED_PGMQ_VERSION",
  imageOverride ? undefined : "1.10.0",
);

if (expectedPostgresMajor && !/^\d+$/.test(expectedPostgresMajor)) {
  throw new Error(
    "BACKGROUND_JOBS_DB_EXPECTED_POSTGRES_MAJOR must contain only digits.",
  );
}

function discoverWaveThreeMigrations() {
  const directory = path.join(repositoryRoot, migrationsDirectory);
  const migrations = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && waveThreeMigrationFilePattern.test(entry.name),
    )
    .map((entry) => path.posix.join(migrationsDirectory, entry.name))
    .sort();

  if (migrations.length === 0) {
    throw new Error(
      `No Wave 3 background-job migrations matched ${waveThreeMigrationFilePattern}.`,
    );
  }
  return migrations;
}

const waveThreeMigrationFiles = discoverWaveThreeMigrations();

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    throw new Error(
      `Docker is required for the isolated PGMQ contract test: ${result.error.message}`,
    );
  }
  return result;
}

function requireSuccess(result, label) {
  if (result.status === 0) return;
  const detail = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  const termination = result.signal ? ` (terminated by ${result.signal})` : "";
  throw new Error(
    `${label} failed${termination}${detail ? `:\n${detail}` : "."}`,
  );
}

function psqlDockerArgs({ quiet = false, singleTransaction = false } = {}) {
  const psqlArgs = [
    "psql",
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--username=postgres",
    "--dbname=postgres",
  ];
  if (quiet) psqlArgs.push("--quiet", "--tuples-only", "--no-align");
  if (singleTransaction) psqlArgs.push("--single-transaction");
  return ["exec", "--interactive", containerName, ...psqlArgs];
}

function psqlAsync(sql, label) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", psqlDockerArgs({ quiet: true }), {
      cwd: repositoryRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let spawnError;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      if (spawnError) {
        reject(new Error(`${label} could not start: ${spawnError.message}`));
        return;
      }
      if (code !== 0) {
        const detail = [stdout, stderr].filter(Boolean).join("\n").trim();
        reject(
          new Error(
            `${label} failed${signal ? ` (${signal})` : ""}${detail ? `:\n${detail}` : "."}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });

    // A missing Docker executable can close stdin before the spawn error is
    // delivered. The process-level error above is the useful diagnostic.
    child.stdin.on("error", () => {});
    child.stdin.end(sql);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stoppedContainerDetail() {
  const inspection = docker([
    "inspect",
    "--format",
    "{{.State.Status}}",
    containerName,
  ]);
  if (inspection.status !== 0) return undefined;

  const status = inspection.stdout.trim();
  if (status !== "dead" && status !== "exited") return undefined;
  const logs = docker(["logs", "--tail", "100", containerName]);
  const detail = [logs.stdout, logs.stderr].filter(Boolean).join("\n").trim();
  return `The isolated database container stopped with status ${status}${
    detail ? `:\n${detail}` : "."
  }`;
}

function reportResolvedImageId() {
  const inspection = docker([
    "inspect",
    "--format",
    "{{.Image}}",
    containerName,
  ]);
  requireSuccess(inspection, "Resolved database image inspection");
  const imageId = inspection.stdout.trim();
  if (!/^sha256:[0-9a-f]{64}$/i.test(imageId)) {
    throw new Error(`Docker returned an invalid resolved image ID: ${imageId}`);
  }
  process.stdout.write(`background-jobs-db: resolved image ${imageId}\n`);
}

async function waitForPostgres() {
  const deadline = Date.now() + readinessTimeoutMs;
  let lastReadinessDetail = "";
  let stablePostmasterStart = "";
  let stableSinceMs = 0;
  while (Date.now() < deadline) {
    const ready = docker([
      "exec",
      containerName,
      "pg_isready",
      "--host=127.0.0.1",
      "--username=postgres",
      "--dbname=postgres",
    ]);
    if (ready.status === 0) {
      const postmasterStart = docker([
        ...psqlDockerArgs({ quiet: true }),
        "--command",
        "select pg_postmaster_start_time()::text;",
      ]);
      if (postmasterStart.status === 0) {
        const currentStart = postmasterStart.stdout.trim();
        if (currentStart && currentStart === stablePostmasterStart) {
          if (Date.now() - stableSinceMs >= readinessStableMs) return;
        } else {
          stablePostmasterStart = currentStart;
          stableSinceMs = Date.now();
        }
        await delay(500);
        continue;
      }
    }

    lastReadinessDetail = [ready.stdout, ready.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    stablePostmasterStart = "";
    stableSinceMs = 0;
    const stoppedDetail = stoppedContainerDetail();
    if (stoppedDetail) throw new Error(stoppedDetail);
    await delay(500);
  }
  throw new Error(
    `The isolated PGMQ Postgres container did not become ready within ${readinessTimeoutMs}ms${
      lastReadinessDetail ? `:\n${lastReadinessDetail}` : "."
    }`,
  );
}

function queryScalar(sql, label) {
  const result = docker([...psqlDockerArgs({ quiet: true }), "--command", sql]);
  requireSuccess(result, label);
  const values = result.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length !== 1) {
    throw new Error(
      `${label} returned ${values.length} values; expected exactly one.`,
    );
  }
  return values[0];
}

function verifyPostgresVersion() {
  const serverVersion = queryScalar(
    "select current_setting('server_version');",
    "PostgreSQL version query",
  );
  const serverVersionNumber = queryScalar(
    "select current_setting('server_version_num');",
    "PostgreSQL numeric version query",
  );
  if (!/^\d{6}$/.test(serverVersionNumber)) {
    throw new Error(
      `PostgreSQL returned an invalid server_version_num: ${serverVersionNumber}`,
    );
  }

  const postgresMajor = String(
    Math.trunc(Number.parseInt(serverVersionNumber, 10) / 10_000),
  );
  if (expectedPostgresMajor && postgresMajor !== expectedPostgresMajor) {
    throw new Error(
      `PostgreSQL major ${postgresMajor} did not match expected major ${expectedPostgresMajor}.`,
    );
  }
  process.stdout.write(
    `background-jobs-db: PostgreSQL ${serverVersion} (major ${postgresMajor})\n`,
  );
}

function verifyPgmqVersion() {
  const pgmqVersion = queryScalar(
    "select extversion from pg_catalog.pg_extension where extname = 'pgmq';",
    "PGMQ extension version query",
  );
  if (!/^\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?$/.test(pgmqVersion)) {
    throw new Error(
      `PGMQ returned an invalid extension version: ${pgmqVersion}`,
    );
  }
  if (expectedPgmqVersion && pgmqVersion !== expectedPgmqVersion) {
    throw new Error(
      `PGMQ extension ${pgmqVersion} did not match expected version ${expectedPgmqVersion}.`,
    );
  }
  process.stdout.write(`background-jobs-db: PGMQ ${pgmqVersion}\n`);
}

function applySql(relativePath, { singleTransaction = false } = {}) {
  const sql = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const result = docker(psqlDockerArgs({ singleTransaction }), { input: sql });
  requireSuccess(result, relativePath);
  process.stdout.write(
    `background-jobs-db: applied ${relativePath}${
      singleTransaction ? " atomically" : ""
    }\n`,
  );
}

function executeSql(sql, label) {
  const result = docker(psqlDockerArgs(), { input: sql });
  requireSuccess(result, label);
}

function verifyAiSyntheticExecutionRollback() {
  const migration = readFileSync(
    path.join(repositoryRoot, aiSyntheticExecutionMigrationFile),
    "utf8",
  );
  executeSql(
    `begin;\n${migration}\nrollback;`,
    "Transactional AI synthetic execution rollback rehearsal",
  );
  const remainingObjects = queryScalar(
    `select count(*)
     from (
       select 'ai_task_jobs' where to_regclass('public.ai_task_jobs') is not null
       union all
       select 'ai_usage_records' where to_regclass('public.ai_usage_records') is not null
       union all
       select 'ai_evaluations' where to_regclass('public.ai_evaluations') is not null
       union all
       select 'ai_task_enqueue_synthetic'
         where to_regprocedure('public.ai_task_enqueue_synthetic(uuid)') is not null
       union all
       select 'ai_synthetic_v1'
         from public.background_job_kinds
         where kind = 'ai_synthetic_v1'
     ) checked;`,
    "AI synthetic rollback residue query",
  );
  if (remainingObjects !== "0") {
    throw new Error(
      `AI synthetic rollback rehearsal left ${remainingObjects} execution objects.`,
    );
  }
  process.stdout.write("background-jobs-db: AI synthetic rollback rehearsal passed\n");
}

function concurrentEnqueueSql({ applicationName, waitForClientB }) {
  return `
set application_name = '${applicationName}';
set statement_timeout = '${concurrencyTimeoutMs + 5_000}ms';
begin;
select 'JOB_ID=' || (public.background_job_enqueue_system(
  p_kind => 'automation_event',
  p_contract_version => 1,
  p_subject_type => 'sql_harness',
  p_subject_id => 'concurrent_enqueue',
  p_project_id => null::uuid,
  p_priority => 100::smallint,
  p_intent_key => '${concurrentIntentKey}',
  p_payload => '{"scenario":"concurrent_enqueue"}'::jsonb,
  p_not_before => null::timestamptz,
  p_rollout_mode => 'worker_enabled'::public.background_job_rollout_mode,
  p_execution_owner => 'worker'::public.background_job_execution_owner,
  p_rollout_cohort => null
)).id::text;
${
  waitForClientB
    ? `do $client_a_barrier$
declare
  v_deadline timestamptz := clock_timestamp() + (${concurrencyTimeoutMs} * interval '1 millisecond');
begin
  loop
    perform pg_catalog.pg_stat_clear_snapshot();
    exit when exists (
      select 1
      from pg_catalog.pg_stat_activity activity
      where activity.application_name = '${clientBApplicationName}'
        and activity.state = 'active'
        and activity.wait_event_type = 'Lock'
        and activity.wait_event = 'advisory'
    );

    if clock_timestamp() >= v_deadline then
      raise exception 'concurrent enqueue client B did not wait on client A advisory lock';
    end if;
    perform pg_sleep(0.05);
  end loop;
end;
$client_a_barrier$;`
    : ""
}
commit;
`;
}

function requireJobId(stdout, label) {
  const jobId = stdout.match(jobIdMarker)?.[1];
  if (!jobId) throw new Error(`${label} did not return a background-job ID.`);
  return jobId.toLowerCase();
}

async function waitForClientAAdvisoryLock(clientAState) {
  const deadline = Date.now() + concurrencyTimeoutMs;
  while (Date.now() < deadline) {
    if (clientAState.error) throw clientAState.error;
    if (clientAState.result) {
      throw new Error(
        "Concurrent enqueue client A completed before acquiring its advisory transaction lock.",
      );
    }

    const lockCount = Number.parseInt(
      queryScalar(
        `select count(*)::text
from pg_catalog.pg_stat_activity activity
join pg_catalog.pg_locks held_lock on held_lock.pid = activity.pid
where activity.application_name = '${clientAApplicationName}'
  and held_lock.locktype = 'advisory'
  and held_lock.granted;`,
        "Concurrent enqueue client A advisory-lock probe",
      ),
      10,
    );
    if (lockCount > 0) return;
    await delay(50);
  }

  throw new Error(
    `Concurrent enqueue client A did not acquire its advisory transaction lock within ${concurrencyTimeoutMs}ms.`,
  );
}

async function verifyConcurrentEnqueue() {
  const clientAState = { result: undefined, error: undefined };
  const clientA = psqlAsync(
    concurrentEnqueueSql({
      applicationName: clientAApplicationName,
      waitForClientB: true,
    }),
    "Concurrent enqueue client A",
  );
  clientA.then(
    (result) => {
      clientAState.result = result;
    },
    (error) => {
      clientAState.error = error;
    },
  );

  await waitForClientAAdvisoryLock(clientAState);
  const clientB = psqlAsync(
    concurrentEnqueueSql({
      applicationName: clientBApplicationName,
      waitForClientB: false,
    }),
    "Concurrent enqueue client B",
  );
  const clientResults = await Promise.allSettled([clientA, clientB]);
  const clientFailures = clientResults
    .filter((result) => result.status === "rejected")
    .map((result) =>
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    );
  if (clientFailures.length > 0) {
    throw new Error(
      `Concurrent enqueue clients failed:\n${clientFailures.join("\n\n")}`,
    );
  }
  const [clientAResult, clientBResult] = clientResults.map(
    (result) => result.value,
  );
  const clientAJobId = requireJobId(
    clientAResult.stdout,
    "Concurrent enqueue client A",
  );
  const clientBJobId = requireJobId(
    clientBResult.stdout,
    "Concurrent enqueue client B",
  );
  if (clientAJobId !== clientBJobId) {
    throw new Error(
      "Concurrent duplicate enqueues returned different background-job IDs.",
    );
  }

  const countResult = await psqlAsync(
    `select 'LEDGER_COUNT=' || count(*)::text
from public.background_jobs
where kind = 'automation_event'
  and intent_key = '${concurrentIntentKey}';`,
    "Concurrent enqueue ledger assertion",
  );
  const ledgerCount = Number.parseInt(
    countResult.stdout.match(/LEDGER_COUNT=(\d+)/)?.[1] ?? "",
    10,
  );
  if (ledgerCount !== 1) {
    throw new Error(
      `Concurrent duplicate enqueue created ${ledgerCount || 0} ledger rows; expected 1.`,
    );
  }

  await psqlAsync(
    `do $cleanup$
declare
  v_job_id uuid;
  v_queue_message_id bigint;
begin
  select id, queue_message_id
  into strict v_job_id, v_queue_message_id
  from public.background_jobs
  where kind = 'automation_event'
    and intent_key = '${concurrentIntentKey}';

  if not pgmq.archive('portal_background_jobs', v_queue_message_id) then
    raise exception 'concurrent enqueue fixture message could not be archived';
  end if;

  delete from public.background_jobs where id = v_job_id;
end;
$cleanup$;`,
    "Concurrent enqueue fixture cleanup",
  );
  process.stdout.write(
    "background-jobs-db: concurrent enqueue contract passed\n",
  );
}

function providerCollisionSetupSql() {
  return `
do $provider_collision_setup$
declare
  v_index integer;
  v_job public.background_jobs%rowtype;
  v_claim record;
  v_worker_id text;
  v_intent_key text;
  v_payload_hash text;
  v_provider_expiry timestamptz := now() + interval '1 hour';
begin
  for v_index in 1..2 loop
    v_worker_id := case
      when v_index = 1 then '${providerCollisionWorkerA}'
      else '${providerCollisionWorkerB}'
    end;
    v_intent_key := case
      when v_index = 1 then '${providerCollisionIntentA}'
      else '${providerCollisionIntentB}'
    end;
    v_payload_hash := repeat(case when v_index = 1 then 'a' else 'b' end, 64);

    select * into strict v_job
    from public.background_job_enqueue_system(
      p_kind => 'quote_send',
      p_contract_version => 1,
      p_subject_type => 'quote',
      p_subject_id => format('provider_collision_%s', v_index),
      p_project_id => null::uuid,
      p_priority => 100::smallint,
      p_intent_key => v_intent_key,
      p_payload => '{}'::jsonb,
      p_not_before => now(),
      p_rollout_mode => 'worker_enabled'::public.background_job_rollout_mode,
      p_execution_owner => 'worker'::public.background_job_execution_owner,
      p_rollout_cohort => 'sql-harness'
    );
    select * into strict v_claim
    from public.background_jobs_claim(
      v_worker_id,
      1,
      ${providerCollisionLeaseSeconds}
    );
    if v_claim.job_id <> v_job.id then
      raise exception 'provider-collision setup claimed an unexpected job';
    end if;

    perform public.background_job_record_progress(
      v_job.id,
      v_worker_id,
      v_claim.lease_token,
      'running',
      'preparing_delivery',
      '{}'::jsonb
    );
    perform public.background_job_record_effect_checkpoint(
      v_job.id,
      v_worker_id,
      v_claim.lease_token,
      'email_dispatch',
      'email_dispatch',
      'prepared',
      v_payload_hash,
      'resend',
      v_intent_key,
      v_provider_expiry,
      null,
      '{}'::jsonb
    );
    perform public.background_job_record_effect_checkpoint(
      v_job.id,
      v_worker_id,
      v_claim.lease_token,
      'email_dispatch',
      'email_dispatch',
      'dispatch_started',
      v_payload_hash,
      'resend',
      v_intent_key,
      v_provider_expiry,
      null,
      '{}'::jsonb
    );
  end loop;
end;
$provider_collision_setup$;
`;
}

function providerCollisionClientSql({
  applicationName,
  intentKey,
  workerId,
  waitForCollision,
}) {
  return `
set application_name = '${applicationName}';
set statement_timeout = '${concurrencyTimeoutMs + 5_000}ms';
begin;
select 'EFFECT_STATE=' || accepted.state::text
from public.background_job_record_provider_acceptance(
  p_job_id => (
    select id from public.background_jobs where intent_key = '${intentKey}'
  ),
  p_worker_id => '${workerId}',
  p_lease_token => (
    select lease_token from public.background_jobs where intent_key = '${intentKey}'
  ),
  p_effect_key => 'email_dispatch',
  p_effect_kind => 'email_dispatch',
  p_payload_hash => (
    select payload_hash
    from public.background_job_effects
    where job_id = (select id from public.background_jobs where intent_key = '${intentKey}')
      and effect_key = 'email_dispatch'
  ),
  p_provider_name => 'resend',
  p_provider_idempotency_key => '${intentKey}',
  p_provider_idempotency_expires_at => (
    select provider_idempotency_expires_at
    from public.background_job_effects
    where job_id = (select id from public.background_jobs where intent_key = '${intentKey}')
      and effect_key = 'email_dispatch'
  ),
  p_provider_message_id => '${providerCollisionMessageId}',
  p_safe_metadata => jsonb_build_object(
    'effectKind', 'email_dispatch',
    'checkpoint', 'provider_accepted',
    'providerName', 'resend',
    'providerAccepted', true
  )
) accepted;
${
  waitForCollision
    ? `set application_name = '${providerCollisionClientAReady}';
do $provider_collision_barrier$
declare
  v_deadline timestamptz := clock_timestamp() + (${concurrencyTimeoutMs} * interval '1 millisecond');
begin
  loop
    perform pg_catalog.pg_stat_clear_snapshot();
    exit when exists (
      select 1
      from pg_catalog.pg_stat_activity blocked
      where blocked.application_name = '${providerCollisionClientB}'
        and blocked.state = 'active'
        and blocked.wait_event_type = 'Lock'
        and blocked.wait_event = 'transactionid'
        and pg_backend_pid() = any(pg_catalog.pg_blocking_pids(blocked.pid))
    );

    if clock_timestamp() >= v_deadline then
      raise exception 'provider-collision client B did not wait on client A unique-index transaction';
    end if;
    perform pg_sleep(0.05);
  end loop;
end;
$provider_collision_barrier$;`
    : ""
}
commit;
`;
}

async function waitForProviderCollisionClientA(clientAState) {
  const deadline = Date.now() + concurrencyTimeoutMs;
  while (Date.now() < deadline) {
    if (clientAState.error) throw clientAState.error;
    if (clientAState.result) {
      throw new Error(
        "Provider-collision client A completed before holding its accepted provider identity.",
      );
    }

    const readyCount = Number.parseInt(
      queryScalar(
        `select count(*)::text
from pg_catalog.pg_stat_activity activity
where activity.application_name = '${providerCollisionClientAReady}'
  and activity.state = 'active';`,
        "Provider-collision client A readiness probe",
      ),
      10,
    );
    if (readyCount === 1) return;
    await delay(50);
  }

  throw new Error(
    `Provider-collision client A was not ready within ${concurrencyTimeoutMs}ms.`,
  );
}

function providerCollisionAssertionSql() {
  return `
do $provider_collision_assertions$
declare
  v_owner_job public.background_jobs%rowtype;
  v_loser_job public.background_jobs%rowtype;
  v_owner_effect public.background_job_effects%rowtype;
  v_loser_effect public.background_job_effects%rowtype;
begin
  select * into strict v_owner_job
  from public.background_jobs
  where intent_key = '${providerCollisionIntentA}';
  select * into strict v_loser_job
  from public.background_jobs
  where intent_key = '${providerCollisionIntentB}';
  select * into strict v_owner_effect
  from public.background_job_effects
  where job_id = v_owner_job.id and effect_key = 'email_dispatch';
  select * into strict v_loser_effect
  from public.background_job_effects
  where job_id = v_loser_job.id and effect_key = 'email_dispatch';

  if v_owner_effect.state <> 'provider_accepted'
     or v_owner_effect.provider_message_id is distinct from '${providerCollisionMessageId}'
     or v_owner_job.status <> 'provider_accepted'
     or v_owner_job.provider_message_id is distinct from '${providerCollisionMessageId}'
     or v_owner_job.lease_owner is distinct from '${providerCollisionWorkerA}'
     or not private.background_job_queue_contains(v_owner_job.queue_message_id) then
    raise exception 'concurrent provider-message winner did not retain its accepted identity and lease';
  end if;

  if v_loser_effect.state <> 'uncertain'
     or v_loser_effect.provider_message_id is not null
     or v_loser_job.status <> 'needs_attention'
     or v_loser_job.error_code is distinct from 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'
     or v_loser_job.lease_owner is not null
     or v_loser_job.lease_token is not null
     or private.background_job_queue_contains(v_loser_job.queue_message_id)
     or not exists (
       select 1
       from pgmq.a_portal_background_jobs archived
       where archived.msg_id = v_loser_job.queue_message_id
     ) then
    raise exception 'concurrent provider-message loser was not atomically quarantined';
  end if;

  if (
    select count(*)
    from public.background_job_effects effect
    where effect.provider_name = 'resend'
      and effect.provider_message_id = '${providerCollisionMessageId}'
  ) <> 1 then
    raise exception 'concurrent provider-message collision created multiple owners';
  end if;

  if not pgmq.archive('portal_background_jobs', v_owner_job.queue_message_id) then
    raise exception 'concurrent provider-message winner queue cleanup failed';
  end if;
  delete from public.background_jobs where id in (v_owner_job.id, v_loser_job.id);
end;
$provider_collision_assertions$;
`;
}

async function verifyConcurrentProviderMessageCollision() {
  await psqlAsync(
    providerCollisionSetupSql(),
    "Concurrent provider-message fixture setup",
  );

  const clientAState = { result: undefined, error: undefined };
  const clientA = psqlAsync(
    providerCollisionClientSql({
      applicationName: providerCollisionClientA,
      intentKey: providerCollisionIntentA,
      workerId: providerCollisionWorkerA,
      waitForCollision: true,
    }),
    "Concurrent provider-message client A",
  );
  clientA.then(
    (result) => {
      clientAState.result = result;
    },
    (error) => {
      clientAState.error = error;
    },
  );

  await waitForProviderCollisionClientA(clientAState);
  const clientB = psqlAsync(
    providerCollisionClientSql({
      applicationName: providerCollisionClientB,
      intentKey: providerCollisionIntentB,
      workerId: providerCollisionWorkerB,
      waitForCollision: false,
    }),
    "Concurrent provider-message client B",
  );
  const clientResults = await Promise.allSettled([clientA, clientB]);
  const failures = clientResults
    .filter((result) => result.status === "rejected")
    .map((result) =>
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    );
  if (failures.length > 0) {
    throw new Error(
      `Concurrent provider-message clients failed:\n${failures.join("\n\n")}`,
    );
  }

  const [clientAResult, clientBResult] = clientResults.map(
    (result) => result.value,
  );
  if (!/EFFECT_STATE=provider_accepted/i.test(clientAResult.stdout)) {
    throw new Error("Concurrent provider-message client A did not retain acceptance.");
  }
  if (!/EFFECT_STATE=uncertain/i.test(clientBResult.stdout)) {
    throw new Error("Concurrent provider-message client B did not return quarantine state.");
  }

  await psqlAsync(
    providerCollisionAssertionSql(),
    "Concurrent provider-message assertions and cleanup",
  );
  process.stdout.write(
    "background-jobs-db: concurrent provider-message collision contract passed\n",
  );
}

let containerStarted = false;
let cleanupInProgress = false;

function cleanupContainer() {
  if (!containerStarted || cleanupInProgress) return;
  cleanupInProgress = true;
  try {
    const removal = docker(["rm", "--force", containerName]);
    requireSuccess(removal, "PGMQ Postgres container cleanup");
    containerStarted = false;
    process.stdout.write(
      `background-jobs-db: removed container ${containerName}\n`,
    );
  } finally {
    cleanupInProgress = false;
  }
}

const signalHandlers = new Map();
for (const [signal, exitCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  const handler = () => {
    process.stderr.write(
      `background-jobs-db: received ${signal}; attempting container cleanup\n`,
    );
    try {
      cleanupContainer();
    } catch (error) {
      process.stderr.write(
        `background-jobs-db: best-effort cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
    process.exit(exitCode);
  };
  signalHandlers.set(signal, handler);
  process.once(signal, handler);
}

async function run() {
  process.stdout.write(
    `background-jobs-db: image ${image}; readiness timeout ${readinessTimeoutMs}ms; stable window ${readinessStableMs}ms\n`,
  );
  process.stdout.write(
    `background-jobs-db: discovered ${waveThreeMigrationFiles.length} ordered background-job migration(s)\n`,
  );
  const version = docker(["version", "--format", "{{.Server.Version}}"]);
  requireSuccess(version, "Docker readiness check");
  process.stdout.write(`background-jobs-db: Docker ${version.stdout.trim()}\n`);

  const start = docker([
    "run",
    "--detach",
    "--name",
    containerName,
    "--label",
    "com.sanctuary.background-jobs-db-harness=true",
    "--env",
    "POSTGRES_PASSWORD=postgres",
    image,
  ]);
  requireSuccess(start, "PGMQ Postgres container start");
  containerStarted = true;
  reportResolvedImageId();

  await waitForPostgres();
  verifyPostgresVersion();
  applySql(bootstrapSqlFile, { singleTransaction: true });
  for (const migration of waveThreeMigrationFiles) {
    applySql(migration, { singleTransaction: true });
  }
  verifyPgmqVersion();
  await verifyConcurrentEnqueue();
  await verifyConcurrentProviderMessageCollision();
  applySql(contractSqlFile);
  applySql(aiBootstrapSqlFile, { singleTransaction: true });
  applySql(aiTaskLedgerMigrationFile, { singleTransaction: true });
  applySql(aiApprovalMigrationFile, { singleTransaction: true });
  verifyAiSyntheticExecutionRollback();
  applySql(aiSyntheticExecutionMigrationFile, { singleTransaction: true });
  applySql(aiSyntheticExecutionContractFile);
  process.stdout.write(
    `background-jobs-db: isolated PGMQ contract passed (${image})\n`,
  );
}

let executionError;
try {
  await run();
} catch (error) {
  executionError = error;
}

let cleanupError;
try {
  cleanupContainer();
} catch (error) {
  cleanupError = error;
}

for (const [signal, handler] of signalHandlers) {
  process.removeListener(signal, handler);
}

if (executionError && cleanupError) {
  throw new AggregateError(
    [executionError, cleanupError],
    "The background-job database contract and container cleanup both failed.",
  );
}
if (executionError) throw executionError;
if (cleanupError) throw cleanupError;
