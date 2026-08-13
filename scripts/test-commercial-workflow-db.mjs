import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const bootstrapPath = path.join(
  repositoryRoot,
  "supabase/tests/commercial_workflow_trust_bootstrap.sql",
);
const migrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260728_000001_commercial_workflow_trust.sql",
);
const staleConflictMigrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260728000002_commercial_quote_stale_conflict.sql",
);
const contractPath = path.join(
  repositoryRoot,
  "supabase/tests/commercial_workflow_trust.sql",
);
const truthBootstrapPath = path.join(
  repositoryRoot,
  "supabase/tests/commercial_truth_invariants_bootstrap.sql",
);
const truthMigrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260813000003_commercial_truth_invariants.sql",
);
const truthContractPath = path.join(
  repositoryRoot,
  "supabase/tests/commercial_truth_invariants.sql",
);

const bootstrapSql = readFileSync(bootstrapPath, "utf8");
const migrationSql = readFileSync(migrationPath, "utf8");
const staleConflictMigrationSql = readFileSync(
  staleConflictMigrationPath,
  "utf8",
);
const contractSql = readFileSync(contractPath, "utf8");
const truthBootstrapSql = readFileSync(truthBootstrapPath, "utf8");
const truthMigrationSql = readFileSync(truthMigrationPath, "utf8");
const truthContractSql = readFileSync(truthContractPath, "utf8");

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function applyTransaction(
  database,
  sql,
  label,
  { rollback = false } = {},
) {
  await database.exec("begin;");
  try {
    await database.exec(sql);
    await database.exec(rollback ? "rollback;" : "commit;");
  } catch (error) {
    try {
      await database.exec("rollback;");
    } catch {
      // Preserve the original migration or contract error.
    }
    throw new Error(`${label} failed`, { cause: error });
  }
}

const database = new PGlite();
const truthDatabase = new PGlite();
let executionError;

try {
  await database.waitReady;
  const versionResult = await database.query(
    "select current_setting('server_version') as version;",
  );
  const version = String(versionResult.rows[0]?.version ?? "");
  requireCondition(
    /^18(?:\.|$)/.test(version),
    `Expected disposable PostgreSQL 18, received ${version || "unknown"}.`,
  );
  process.stdout.write(`commercial-workflow-db: PostgreSQL ${version}\n`);

  await database.exec(bootstrapSql);
  process.stdout.write("commercial-workflow-db: bootstrap applied\n");

  await applyTransaction(database, migrationSql, "Rollback migration", {
    rollback: true,
  });
  const rollbackProbe = await database.query(`
    select
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'quote_versions'
          and column_name = 'commercial_revision'
      ) as revision_column_exists,
      to_regclass('private.commercial_email_intents') is not null
        as intent_table_exists;
  `);
  requireCondition(
    rollbackProbe.rows[0]?.revision_column_exists === false &&
      rollbackProbe.rows[0]?.intent_table_exists === false,
    "The migration did not roll back cleanly.",
  );
  process.stdout.write("commercial-workflow-db: rollback contract passed\n");

  await applyTransaction(database, migrationSql, "Committed migration");
  process.stdout.write(
    "commercial-workflow-db: migration applied atomically\n",
  );

  await applyTransaction(database, migrationSql, "Idempotent migration replay");
  process.stdout.write("commercial-workflow-db: migration replay passed\n");

  await applyTransaction(
    database,
    staleConflictMigrationSql,
    "Rollback stale-conflict correction",
    { rollback: true },
  );
  const staleConflictRollbackProbe = await database.query(`
    select position(
      '40001' in pg_get_functiondef(
        'public.commercial_quote_update_draft(uuid,bigint,text,text,text,numeric,date,uuid,integer,integer,integer,text,jsonb,jsonb)'::regprocedure
      )
    ) > 0 as serialization_code_retained;
  `);
  requireCondition(
    staleConflictRollbackProbe.rows[0]?.serialization_code_retained === true,
    "The stale-conflict correction did not roll back cleanly.",
  );
  process.stdout.write(
    "commercial-workflow-db: stale-conflict correction rollback passed\n",
  );

  await applyTransaction(
    database,
    staleConflictMigrationSql,
    "Committed stale-conflict correction",
  );
  await applyTransaction(
    database,
    staleConflictMigrationSql,
    "Idempotent stale-conflict correction replay",
  );
  process.stdout.write(
    "commercial-workflow-db: stale-conflict correction applied and replayed\n",
  );

  await database.exec(contractSql);
  process.stdout.write(
    "commercial-workflow-db: quote, delivery, acceptance, invoice, and grant contracts passed\n",
  );

  await truthDatabase.waitReady;
  await truthDatabase.exec(truthBootstrapSql);
  process.stdout.write("commercial-workflow-db: truth bootstrap applied\n");
  await applyTransaction(
    truthDatabase,
    truthMigrationSql,
    "Rollback truth migration",
    { rollback: true },
  );
  const truthRollbackProbe = await truthDatabase.query(`
    select to_regprocedure('public.commercial_project_financial_truth(uuid)') is null
      as truth_function_absent;
  `);
  requireCondition(
    truthRollbackProbe.rows[0]?.truth_function_absent === true,
    "The commercial truth migration did not roll back cleanly.",
  );
  process.stdout.write("commercial-workflow-db: truth rollback contract passed\n");
  await applyTransaction(
    truthDatabase,
    truthMigrationSql,
    "Committed truth migration",
  );
  await applyTransaction(
    truthDatabase,
    truthMigrationSql,
    "Idempotent truth migration replay",
  );
  process.stdout.write(
    "commercial-workflow-db: truth migration applied and replayed\n",
  );
  await truthDatabase.exec(truthContractSql);
  process.stdout.write(
    "commercial-workflow-db: authoritative totals, lifecycle, invoice, payment, and completion contracts passed\n",
  );
} catch (error) {
  executionError = error;
}

let closeError;
try {
  await Promise.all([database.close(), truthDatabase.close()]);
} catch (error) {
  closeError = error;
}

if (executionError && closeError) {
  throw new AggregateError(
    [executionError, closeError],
    "The commercial-workflow contract and disposable database cleanup both failed.",
  );
}
if (executionError) throw executionError;
if (closeError) throw closeError;
