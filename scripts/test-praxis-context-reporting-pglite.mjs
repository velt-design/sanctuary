import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(import.meta.dirname, '..');
const bootstrap = readFileSync(path.join(root, 'supabase/tests/praxis_context_reporting_bootstrap.sql'), 'utf8');
const migration = readFileSync(path.join(root, 'supabase/migrations/20260903000001_praxis_context_reporting_v1.sql'), 'utf8');

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectDenied(database, sql, label) {
  try {
    await database.exec(sql);
  } catch (error) {
    const code = String(error?.code ?? '');
    requireCondition(
      ['25006', '42501', '55000'].includes(code) || /permission denied|read-only/i.test(String(error?.message)),
      `${label} failed for an unexpected reason: ${error?.message ?? error}`,
    );
    process.stdout.write(`praxis-context-db: denied ${label}\n`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

const database = new PGlite();
try {
  await database.waitReady;
  await database.exec(bootstrap);

  await database.exec('begin;');
  await database.exec(migration);
  await database.exec('rollback;');
  const rollbackProbe = await database.query("select to_regnamespace('praxis_reporting') is null as clean");
  requireCondition(rollbackProbe.rows[0]?.clean === true, 'Migration did not roll back cleanly.');
  process.stdout.write('praxis-context-db: rollback proof passed\n');

  await database.exec(migration);
  await database.exec(migration);
  await database.exec(`
    insert into praxis_reporting.source_identity_v1 (
      source_key, connection_id, environment, projection_version, configured_by
    ) values (
      'sanctuary', 'a0000000-0000-4000-8000-000000000001', 'test',
      'sanctuary.praxis.core.v1', 'disposable-test'
    );
  `);
  process.stdout.write('praxis-context-db: migration and idempotent replay passed\n');

  const grants = await database.query(`
    select
      rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
      has_schema_privilege('sanctuary_praxis_reader', 'praxis_reporting', 'USAGE') as reporting_usage,
      has_table_privilege('sanctuary_praxis_reader', 'praxis_reporting.projects_v1', 'SELECT') as reporting_select,
      has_table_privilege('sanctuary_praxis_reader', 'public.projects', 'SELECT') as base_select,
      has_table_privilege('sanctuary_praxis_reader', 'private.commercial_email_intents', 'SELECT') as private_select,
      has_table_privilege('sanctuary_praxis_reader', 'auth.users', 'SELECT') as auth_select,
      has_table_privilege('sanctuary_praxis_reader', 'storage.objects', 'SELECT') as storage_select,
      has_sequence_privilege('sanctuary_praxis_reader', 'public.praxis_probe_sequence', 'USAGE') as sequence_usage,
      has_function_privilege('sanctuary_praxis_reader', 'public.commercial_record_project_payment_entry()', 'EXECUTE') as write_execute
    from pg_roles where rolname = 'sanctuary_praxis_reader'
  `);
  const role = grants.rows[0];
  requireCondition(role && role.rolcanlogin === false && role.rolsuper === false, 'Reader role is not NOLOGIN/NOSUPERUSER.');
  requireCondition(role.rolcreatedb === false && role.rolcreaterole === false && role.rolreplication === false && role.rolbypassrls === false, 'Reader role has elevated capability.');
  requireCondition(role.reporting_usage === true && role.reporting_select === true, 'Reporting grants are incomplete.');
  requireCondition([role.base_select, role.private_select, role.auth_select, role.storage_select, role.sequence_usage, role.write_execute].every((value) => value === false), 'A forbidden grant is present.');
  process.stdout.write('praxis-context-db: exact role/grant contract passed\n');

  await database.exec(`
    create role sanctuary_praxis_reader_probe login inherit
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant sanctuary_praxis_reader to sanctuary_praxis_reader_probe;
    alter role sanctuary_praxis_reader_probe set default_transaction_read_only = on;
    set session authorization sanctuary_praxis_reader_probe;
    set default_transaction_read_only = on;
  `);
  const page = await database.query(`
    select resource, payload, record_version
    from praxis_reporting.context_page_v1(
      'all', '10000000-0000-4000-8000-000000000001', null, now() + interval '1 minute',
      null, null, null, 100
    )
  `);
  requireCondition(page.rows.some((row) => row.resource === 'project_financial_truth'), 'Canonical financial truth is not readable.');
  const serialized = JSON.stringify(page.rows);
  for (const forbidden of ['secret-token-hash', 'raw_payload', 'commercial_design_input', 'protected_payload', 'encrypted_password', 'path_tokens']) {
    requireCondition(!serialized.includes(forbidden), `Projection exposed forbidden material: ${forbidden}`);
  }
  process.stdout.write('praxis-context-db: bounded projection and exclusion contract passed\n');

  await expectDenied(database, "select * from public.projects", 'base-table SELECT');
  await expectDenied(database, "select * from private.commercial_email_intents", 'private-table SELECT');
  await expectDenied(database, "select * from auth.users", 'auth-table SELECT');
  await expectDenied(database, "select * from storage.objects", 'storage-table SELECT');
  await expectDenied(database, "insert into public.projects (id,name,pipeline_stage,version,created_at,updated_at) values ('90000000-0000-4000-8000-000000000001','x','NEW',1,now(),now())", 'INSERT');
  await expectDenied(database, "update public.projects set name='x'", 'UPDATE');
  await expectDenied(database, "delete from public.projects", 'DELETE');
  await expectDenied(database, "truncate public.projects", 'TRUNCATE');
  await expectDenied(database, "copy public.projects to stdout", 'COPY');
  await expectDenied(database, "select nextval('public.praxis_probe_sequence')", 'sequence use');
  await expectDenied(database, "select public.commercial_record_project_payment_entry()", 'write RPC execution');
  await expectDenied(database, "select public.commercial_quote_update_draft()", 'quote write RPC execution');
  await expectDenied(database, "select public.commercial_create_admin_invoice()", 'invoice write RPC execution');
  await expectDenied(database, "select public.commercial_change_payment_allocation()", 'allocation write RPC execution');
  await expectDenied(database, "select * from public.commercial_project_financial_truth('10000000-0000-4000-8000-000000000001')", 'direct canonical function execution');
  process.stdout.write('praxis-context-db: customer and financial write-denial proof passed\n');
} finally {
  await database.close();
}
