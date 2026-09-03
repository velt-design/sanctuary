import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const image = process.env.PRAXIS_REPORTING_DB_IMAGE?.trim() || 'postgres:17-alpine';
const expectedMajor = process.env.PRAXIS_REPORTING_DB_EXPECTED_POSTGRES_MAJOR?.trim() || '17';
const container = `sanctuary-praxis-reporting-${process.pid}-${Date.now()}`;
const adminPassword = 'synthetic-praxis-admin-only';
const readerPassword = 'synthetic-praxis-reader-only';

const pgliteBootstrap = readFileSync(
  path.join(root, 'supabase/tests/praxis_context_reporting_bootstrap.sql'),
  'utf8',
);
const stubStart = pgliteBootstrap.indexOf('-- PGlite test double for Supabase');
const stubEnd = pgliteBootstrap.indexOf('\n\ncreate table public.contacts', stubStart);
if (stubStart < 0 || stubEnd < 0) throw new Error('Could not locate the PGlite digest stub.');
const bootstrap = `${pgliteBootstrap.slice(0, stubStart)}create extension pgcrypto with schema extensions;${pgliteBootstrap.slice(stubEnd)}`;
const migration = readFileSync(
  path.join(root, 'supabase/migrations/20260903000001_praxis_context_reporting_v1.sql'),
  'utf8',
);

function docker(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status === 0) return result.stdout.trim();
  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  throw new Error(`${label} failed${detail ? `:\n${detail}` : '.'}`);
}

function psql(sql, label, { reader = false, quiet = false } = {}) {
  const args = ['exec', '--interactive'];
  if (reader) args.push('--env', `PGPASSWORD=${readerPassword}`);
  args.push(
    container,
    'psql',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    ...(reader ? ['--host=127.0.0.1', '--username=sanctuary_praxis_reader_probe'] : ['--username=postgres']),
    '--dbname=postgres',
  );
  if (quiet) args.push('--quiet', '--tuples-only', '--no-align');
  return requireSuccess(docker(args, { input: sql }), label);
}

function expectReaderDenied(sql, label) {
  const result = docker([
    'exec', '--interactive', '--env', `PGPASSWORD=${readerPassword}`,
    container, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--host=127.0.0.1', '--username=sanctuary_praxis_reader_probe', '--dbname=postgres',
  ], { input: `set default_transaction_read_only = off;\n${sql}` });
  if (result.status === 0) throw new Error(`${label} unexpectedly succeeded.`);
  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (!/permission denied|read-only transaction|cannot execute/i.test(detail)) {
    throw new Error(`${label} failed for an unexpected reason:\n${detail}`);
  }
  process.stdout.write(`praxis-reporting-db: denied ${label}\n`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDatabase() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = docker(['exec', container, 'pg_isready', '--host=127.0.0.1', '--username=postgres']);
    if (result.status === 0) return;
    await delay(500);
  }
  throw new Error('Disposable Praxis reporting database did not become ready.');
}

let started = false;
try {
  requireSuccess(docker([
    'run', '--detach', '--rm', '--name', container,
    '--env', `POSTGRES_PASSWORD=${adminPassword}`, image,
  ]), 'Disposable Praxis reporting database start');
  started = true;
  await waitForDatabase();

  const versionNumber = psql("select current_setting('server_version_num');", 'PostgreSQL version query', { quiet: true });
  const major = String(Math.trunc(Number.parseInt(versionNumber, 10) / 10_000));
  if (major !== expectedMajor) throw new Error(`Expected PostgreSQL ${expectedMajor}, received ${major}.`);
  const imageId = requireSuccess(docker(['inspect', '--format', '{{.Image}}', container]), 'Image identity');
  if (!/^sha256:[0-9a-f]{64}$/i.test(imageId)) throw new Error(`Invalid image identity: ${imageId}`);
  process.stdout.write(`praxis-reporting-db: PostgreSQL ${major}, image ${imageId}\n`);

  psql(bootstrap, 'Praxis reporting bootstrap');
  psql(`begin;\n${migration}\nrollback;`, 'Migration rollback rehearsal');
  const rollbackClean = psql("select to_regnamespace('praxis_reporting') is null;", 'Rollback residue check', { quiet: true });
  if (rollbackClean !== 't') throw new Error('Migration rollback left reporting objects.');
  psql(migration, 'Migration application');
  psql(migration, 'Idempotent migration replay');
  psql(`
    insert into praxis_reporting.source_identity_v1 (
      source_key, connection_id, environment, projection_version, configured_by
    ) values (
      'sanctuary', 'a0000000-0000-4000-8000-000000000001', 'test',
      'sanctuary.praxis.core.v1', 'disposable-postgres-test'
    );
    create role sanctuary_praxis_reader_probe login inherit password '${readerPassword}'
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant sanctuary_praxis_reader to sanctuary_praxis_reader_probe;
    alter role sanctuary_praxis_reader_probe set default_transaction_read_only = on;
  `, 'Synthetic reader provisioning');

  const roleContract = psql(`
    select concat_ws(',',
      not rolcanlogin, not rolsuper, not rolcreatedb, not rolcreaterole,
      not rolreplication, not rolbypassrls,
      has_schema_privilege('sanctuary_praxis_reader', 'praxis_reporting', 'USAGE'),
      has_table_privilege('sanctuary_praxis_reader', 'praxis_reporting.projects_v1', 'SELECT'),
      not has_table_privilege('sanctuary_praxis_reader', 'public.projects', 'SELECT'),
      not has_table_privilege('sanctuary_praxis_reader', 'private.commercial_email_intents', 'SELECT'),
      not has_table_privilege('sanctuary_praxis_reader', 'auth.users', 'SELECT'),
      not has_table_privilege('sanctuary_praxis_reader', 'storage.objects', 'SELECT'),
      not has_sequence_privilege('sanctuary_praxis_reader', 'public.praxis_probe_sequence', 'USAGE'),
      not has_function_privilege('sanctuary_praxis_reader', 'public.commercial_record_project_payment_entry()', 'EXECUTE')
    ) from pg_roles where rolname = 'sanctuary_praxis_reader';
  `, 'Role/grant contract', { quiet: true });
  if (roleContract !== Array(14).fill('true').join(',')) throw new Error(`Reader role contract failed: ${roleContract}`);

  const readerPosture = psql(`
    select concat_ws(',',
      current_user = 'sanctuary_praxis_reader_probe',
      current_setting('default_transaction_read_only') = 'on',
      pg_has_role(current_user, 'sanctuary_praxis_reader', 'member'),
      not pg_has_role(current_user, 'service_role', 'member'),
      not has_schema_privilege(current_user, 'public', 'CREATE'),
      not has_table_privilege(current_user, 'public.projects', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
      not has_sequence_privilege(current_user, 'public.praxis_probe_sequence', 'USAGE,SELECT,UPDATE')
    );
  `, 'Concrete LOGIN posture', { reader: true, quiet: true });
  if (readerPosture !== Array(7).fill('true').join(',')) throw new Error(`Reader LOGIN posture failed: ${readerPosture}`);

  const projection = psql(`
    begin read only;
    select resource || '|' || payload::text
    from praxis_reporting.context_page_v1(
      'all', '10000000-0000-4000-8000-000000000001', null,
      now() + interval '1 minute', null, null, null, 100
    ) order by resource;
    rollback;
  `, 'Reader projection', { reader: true, quiet: true });
  if (!projection.includes('project_financial_truth') || !projection.includes('Test Project') || !projection.includes('Ada Customer')) {
    throw new Error('Canonical financial truth and safe fixture payloads were not returned.');
  }
  for (const forbidden of ['secret-token-hash', 'raw_payload', 'commercial_design_input', 'protected_payload', 'encrypted_password', 'path_tokens']) {
    if (projection.includes(forbidden)) throw new Error(`Projection exposed forbidden material: ${forbidden}`);
  }
  process.stdout.write('praxis-reporting-db: canonical bounded projection passed\n');

  expectReaderDenied('select * from public.projects;', 'base-table SELECT');
  expectReaderDenied('select * from private.commercial_email_intents;', 'private-table SELECT');
  expectReaderDenied('select * from auth.users;', 'auth-table SELECT');
  expectReaderDenied('select * from storage.objects;', 'storage-table SELECT');
  expectReaderDenied("insert into public.projects (id,name,pipeline_stage,version,created_at,updated_at) values ('90000000-0000-4000-8000-000000000001','x','NEW',1,now(),now());", 'INSERT');
  expectReaderDenied("update public.projects set name='x';", 'UPDATE');
  expectReaderDenied('delete from public.projects;', 'DELETE');
  expectReaderDenied('truncate public.projects;', 'TRUNCATE');
  expectReaderDenied('copy public.projects to stdout;', 'COPY');
  expectReaderDenied("select nextval('public.praxis_probe_sequence');", 'sequence use');
  expectReaderDenied('select public.commercial_record_project_payment_entry();', 'write RPC execution');
  expectReaderDenied('select public.commercial_quote_update_draft();', 'quote write RPC execution');
  expectReaderDenied('select public.commercial_create_admin_invoice();', 'invoice write RPC execution');
  expectReaderDenied('select public.commercial_change_payment_allocation();', 'allocation write RPC execution');
  expectReaderDenied("select * from public.commercial_project_financial_truth('10000000-0000-4000-8000-000000000001');", 'direct canonical function execution');
  process.stdout.write('praxis-reporting-db: real PostgreSQL denial contract passed\n');
} finally {
  if (started) docker(['rm', '--force', container]);
}
