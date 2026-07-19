import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const image =
  process.env.BACKGROUND_JOBS_DB_IMAGE?.trim() ||
  "ghcr.io/pgmq/pg18-pgmq:v1.10.0";
const containerName = `sanctuary-background-jobs-${process.pid}-${Date.now()}`;
const setupSqlFiles = [
  "supabase/tests/background_jobs_bootstrap.sql",
  "supabase/migrations/20260720_000001_background_job_foundation.sql",
  "supabase/migrations/20260720_000002_background_job_enqueue_claim.sql",
  "supabase/migrations/20260720_000003_background_job_lifecycle.sql",
  "supabase/migrations/20260720_000004_background_job_reconciliation.sql",
];
const contractSqlFile = "supabase/tests/background_jobs.sql";
const concurrentIntentKey = "sql-harness/concurrent-enqueue";
const jobIdMarker =
  /JOB_ID=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
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
  throw new Error(`${label} failed${detail ? `:\n${detail}` : "."}`);
}

function psqlAsync(sql, label, onStdout) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "--interactive",
        containerName,
        "psql",
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set=ON_ERROR_STOP=1",
        "--username=postgres",
        "--dbname=postgres",
      ],
      {
        cwd: repositoryRoot,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let spawnError;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      onStdout?.(stdout);
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

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = docker(
      [
        "exec",
        containerName,
        "pg_isready",
        "--username=postgres",
        "--dbname=postgres",
      ],
      {
        stdio: "ignore",
      },
    );
    if (ready.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "The isolated PGMQ Postgres container did not become ready within 30 seconds.",
  );
}

function applySql(relativePath) {
  const sql = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const result = docker(
    [
      "exec",
      "--interactive",
      containerName,
      "psql",
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      "--dbname=postgres",
    ],
    { input: sql },
  );
  requireSuccess(result, relativePath);
  process.stdout.write(`background-jobs-db: applied ${relativePath}\n`);
}

function concurrentEnqueueSql({ holdTransactionOpen }) {
  return `
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
${holdTransactionOpen ? "select pg_sleep(1.75);" : ""}
commit;
`;
}

function requireJobId(stdout, label) {
  const jobId = stdout.match(jobIdMarker)?.[1];
  if (!jobId) throw new Error(`${label} did not return a background-job ID.`);
  return jobId.toLowerCase();
}

async function verifyConcurrentEnqueue() {
  let resolveClientAEnqueued;
  const clientAEnqueued = new Promise((resolve) => {
    resolveClientAEnqueued = resolve;
  });
  let clientACompleted = false;
  const clientA = psqlAsync(
    concurrentEnqueueSql({ holdTransactionOpen: true }),
    "Concurrent enqueue client A",
    (stdout) => {
      const jobId = stdout.match(jobIdMarker)?.[1];
      if (jobId) resolveClientAEnqueued(jobId.toLowerCase());
    },
  ).finally(() => {
    clientACompleted = true;
  });

  const clientAJobId = await Promise.race([
    clientAEnqueued,
    clientA.then((result) =>
      requireJobId(result.stdout, "Concurrent enqueue client A"),
    ),
  ]);
  if (clientACompleted) {
    throw new Error(
      "Concurrent enqueue client A committed before client B could start.",
    );
  }

  const clientB = psqlAsync(
    concurrentEnqueueSql({ holdTransactionOpen: false }),
    "Concurrent enqueue client B",
  );
  const [clientAResult, clientBResult] = await Promise.all([clientA, clientB]);
  const committedClientAJobId = requireJobId(
    clientAResult.stdout,
    "Concurrent enqueue client A",
  );
  const clientBJobId = requireJobId(
    clientBResult.stdout,
    "Concurrent enqueue client B",
  );
  if (clientAJobId !== committedClientAJobId || clientAJobId !== clientBJobId) {
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

let started = false;
try {
  const version = docker(["version", "--format", "{{.Server.Version}}"]);
  requireSuccess(version, "Docker readiness check");

  const start = docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    containerName,
    "--env",
    "POSTGRES_PASSWORD=postgres",
    image,
  ]);
  requireSuccess(start, "PGMQ Postgres container start");
  started = true;

  await waitForPostgres();
  for (const sqlFile of setupSqlFiles) applySql(sqlFile);
  await verifyConcurrentEnqueue();
  applySql(contractSqlFile);
  process.stdout.write(
    `background-jobs-db: isolated PGMQ contract passed (${image})\n`,
  );
} finally {
  if (started) docker(["rm", "--force", containerName], { stdio: "ignore" });
}
