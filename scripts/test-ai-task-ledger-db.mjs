import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const image =
  process.env.AI_TASK_LEDGER_DB_IMAGE?.trim() ||
  "public.ecr.aws/supabase/postgres:17.6.1.107";
const expectedMajor = process.env.AI_TASK_LEDGER_DB_EXPECTED_POSTGRES_MAJOR?.trim();
const containerName = `sanctuary-ai-ledger-${process.pid}-${Date.now()}`;
const password = "synthetic-ai-ledger-contract-only";

const bootstrap = readFileSync(
  path.join(repositoryRoot, "supabase/tests/ai_task_ledger_bootstrap.sql"),
  "utf8",
);
const migration = readFileSync(
  path.join(
    repositoryRoot,
    "supabase/migrations/20260818000002_ai_task_ledger.sql",
  ),
  "utf8",
);
const contract = readFileSync(
  path.join(repositoryRoot, "supabase/tests/ai_task_ledger.sql"),
  "utf8",
);

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status === 0) return result.stdout.trim();
  const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(`${label} failed${detail ? `:\n${detail}` : "."}`);
}

function psql(sql, label, quiet = false) {
  const args = [
    "exec",
    "--interactive",
    containerName,
    "psql",
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--username=postgres",
    "--dbname=postgres",
  ];
  if (quiet) args.push("--quiet", "--tuples-only", "--no-align");
  return requireSuccess(docker(args, { input: sql }), label);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDatabase() {
  const deadline = Date.now() + 120_000;
  let lastDetail = "";
  while (Date.now() < deadline) {
    const result = docker([
      "exec",
      containerName,
      "pg_isready",
      "--host=127.0.0.1",
      "--username=postgres",
      "--dbname=postgres",
    ]);
    if (result.status === 0) return;
    lastDetail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    await delay(500);
  }
  throw new Error(
    `Disposable AI ledger database did not become ready${
      lastDetail ? `:\n${lastDetail}` : "."
    }`,
  );
}

function verifyDatabaseIdentity() {
  const versionNumber = psql(
    "select current_setting('server_version_num');",
    "PostgreSQL version query",
    true,
  );
  const major = String(Math.trunc(Number.parseInt(versionNumber, 10) / 10_000));
  if (expectedMajor && major !== expectedMajor) {
    throw new Error(`Expected PostgreSQL ${expectedMajor}, received ${major}.`);
  }

  const imageId = requireSuccess(
    docker(["inspect", "--format", "{{.Image}}", containerName]),
    "Resolved image inspection",
  );
  if (!/^sha256:[0-9a-f]{64}$/i.test(imageId)) {
    throw new Error(`Docker returned an invalid image ID: ${imageId}`);
  }
  process.stdout.write(`ai-task-ledger-db: PostgreSQL ${major}, image ${imageId}\n`);
}

function verifyRollbackRehearsal() {
  psql(
    `begin;\n${migration}\nrollback;`,
    "Transactional migration rollback rehearsal",
  );
  const remainingObjects = psql(
    `select count(*)
     from (
       values
         (to_regclass('public.ai_tasks')::oid),
         (to_regclass('public.ai_task_events')::oid),
         (to_regclass('private.ai_task_payloads')::oid),
         (to_regclass('private.ai_task_command_receipts')::oid),
         (to_regtype('public.ai_task_status')::oid)
     ) checked(object_oid)
     where object_oid is not null;`,
    "Rollback residue query",
    true,
  );
  if (remainingObjects !== "0") {
    throw new Error(`Rollback rehearsal left ${remainingObjects} AI ledger objects.`);
  }
  process.stdout.write("ai-task-ledger-db: rollback rehearsal passed\n");
}

let started = false;
try {
  requireSuccess(
    docker([
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      image,
    ]),
    "Disposable AI ledger database start",
  );
  started = true;
  await waitForDatabase();
  verifyDatabaseIdentity();
  psql(bootstrap, "AI ledger test bootstrap");
  verifyRollbackRehearsal();
  psql(migration, "AI ledger migration application");
  psql(contract, "AI ledger executable contract");
  process.stdout.write("ai-task-ledger-db: executable contract passed\n");
} finally {
  if (started) {
    docker(["rm", "--force", containerName]);
  }
}
