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

  psql('grant execute on function public.praxis_probe_callable_definer() to sanctuary_praxis_reader_probe;', 'Synthetic callable definer over-grant');
  const callableDefinerDetected = psql(`
    select exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname in ('public', 'private', 'auth', 'storage', 'extensions', 'praxis_reporting')
        and procedure.prosecdef
        and procedure.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
        and has_function_privilege(current_user, procedure.oid, 'EXECUTE')
        and procedure.oid not in (
          'praxis_reporting.version_v1(jsonb)'::regprocedure,
          'praxis_reporting.project_financial_truth_for_v1(uuid)'::regprocedure
        )
    );
  `, 'Callable security-definer escalation detection', { reader: true, quiet: true });
  if (callableDefinerDetected !== 't') throw new Error('Callable SECURITY DEFINER escalation was not detected.');
  psql('revoke execute on function public.praxis_probe_callable_definer() from sanctuary_praxis_reader_probe;', 'Synthetic callable definer over-grant removal');

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
      not has_function_privilege('sanctuary_praxis_reader', 'public.commercial_record_project_payment_entry()', 'EXECUTE'),
      not exists (
        select 1 from pg_proc procedure
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage', 'extensions', 'praxis_reporting')
          and procedure.prosecdef
          and procedure.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
          and has_function_privilege('sanctuary_praxis_reader', procedure.oid, 'EXECUTE')
          and procedure.oid not in (
            'praxis_reporting.version_v1(jsonb)'::regprocedure,
            'praxis_reporting.project_financial_truth_for_v1(uuid)'::regprocedure
          )
      )
    ) from pg_roles where rolname = 'sanctuary_praxis_reader';
  `, 'Role/grant contract', { quiet: true });
  if (roleContract !== Array(15).fill('t').join(',')) throw new Error(`Reader role contract failed: ${roleContract}`);

  const readerPosture = psql(`
    select concat_ws(',',
      current_user = 'sanctuary_praxis_reader_probe',
      current_setting('transaction_read_only') = 'on',
      current_setting('default_transaction_read_only') = 'on',
      pg_has_role(current_user, 'sanctuary_praxis_reader', 'member'),
      not pg_has_role(current_user, 'service_role', 'member'),
      not exists (
        select 1 from pg_roles granted_role
        where granted_role.rolname not in (current_user::text, 'sanctuary_praxis_reader')
          and pg_has_role(current_user, granted_role.oid, 'member')
      ),
      not has_schema_privilege(current_user, 'public', 'CREATE'),
      not has_table_privilege(current_user, 'public.projects', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
      not has_sequence_privilege(current_user, 'public.praxis_probe_sequence', 'USAGE,SELECT,UPDATE'),
      not exists (
        select 1 from pg_proc procedure
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage', 'extensions', 'praxis_reporting')
          and procedure.prosecdef
          and procedure.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
          and has_function_privilege(current_user, procedure.oid, 'EXECUTE')
          and procedure.oid not in (
            'praxis_reporting.version_v1(jsonb)'::regprocedure,
            'praxis_reporting.project_financial_truth_for_v1(uuid)'::regprocedure
          )
      )
    );
  `, 'Concrete LOGIN posture', { reader: true, quiet: true });
  if (readerPosture !== Array(10).fill('t').join(',')) throw new Error(`Reader LOGIN posture failed: ${readerPosture}`);

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
  for (const resource of [
    'enquiry_request', 'contact', 'project', 'estimate', 'quote', 'quote_version',
    'quote_line_item', 'invoice', 'invoice_plan_item', 'payment',
    'payment_allocation', 'project_financial_truth',
  ]) {
    if (!projection.includes(`${resource}|`)) throw new Error(`Projection omitted resource: ${resource}`);
  }
  if (!projection.includes('attachmentSide') || !projection.includes('rear')) {
    throw new Error('Projection omitted the safe nested estimate shape.');
  }
  if (!projection.includes('commercialInputHash') || !projection.includes('d'.repeat(64))) {
    throw new Error('Projection omitted the approved commercial integrity hash.');
  }
  if (!projection.includes('[redacted]') || !projection.includes('credential_value')) {
    throw new Error('Projection omitted free-text redaction or its evidence.');
  }
  for (const forbidden of [
    'secret-token-hash', 'raw_payload', 'commercial_design_input', 'protected_payload',
    'encrypted_password', 'path_tokens', 'nested-enquiry-secret', 'private/enquiry.pdf',
    'nested-utm-secret', 'private-provider-id', 'nested-summary-secret',
    'nested-input-secret', 'private/design.pdf', 'nested-output-secret',
    'nested-warning-secret', 'nested-metadata-secret', 'nested-token-hash', 'private-commercial-design',
    'nested-token-hash', 'private-invoice-token-hash',
  ]) {
    if (projection.includes(forbidden)) throw new Error(`Projection exposed forbidden material: ${forbidden}`);
  }
  process.stdout.write('praxis-reporting-db: canonical bounded projection passed\n');

  const bounds = psql(`
    with cases(label, input) as (values
      ('entries_exact', jsonb_build_object('items', (select jsonb_agg(value) from generate_series(1, 255) value))),
      ('entries_over', jsonb_build_object('items', (select jsonb_agg(value) from generate_series(1, 256) value))),
      ('bytes_exact', jsonb_build_object('a', repeat('x', 65527))),
      ('bytes_over', jsonb_build_object('a', repeat('x', 65528))),
      ('depth_exact', '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":"ok"}}}}}}}}'::jsonb),
      ('depth_over', '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":"too-deep"}}}}}}}}}'::jsonb)
    )
    select label || '|' || octet_length(convert_to(payload::text, 'UTF8')) || '|' ||
      omission_count || '|' || payload::text
    from cases cross join lateral praxis_reporting.safe_payload_v1(input)
    order by label;
  `, 'Source JSON boundary corpus', { reader: true, quiet: true });
  if (!bounds.includes('bytes_exact|65536|0|') || !bounds.includes('bytes_over|') ||
      !bounds.includes('entries_exact|') || !bounds.includes('entries_over|') ||
      !bounds.includes('depth_exact|') || !bounds.includes('depth_over|')) {
    throw new Error('Source JSON boundary corpus was incomplete.');
  }
  const omittedRows = bounds.split(/\r?\n/).filter((line) => /^(bytes_over|entries_over|depth_over)\|/.test(line));
  if (omittedRows.length !== 3 || omittedRows.some((line) => !line.includes('source_bounds_v1') || !line.includes('|1|'))) {
    throw new Error('Boundary+1 values were not deterministically omitted.');
  }
  const preservedRows = bounds.split(/\r?\n/).filter((line) => /^(bytes_exact|entries_exact|depth_exact)\|/.test(line));
  if (preservedRows.some((line) => line.includes('source_bounds_v1') || !line.includes('|0|'))) {
    throw new Error('Boundary values were omitted early.');
  }
  process.stdout.write('praxis-reporting-db: source JSON boundary and evidence contract passed\n');

  const beforeAssignment = psql(`
    select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    from public.project_invoice_plan_items
    where id = '80000000-0000-4000-8000-000000000001';
  `, 'Invoice-plan pre-assignment freshness', { quiet: true });
  psql(`
    select pg_sleep(0.01);
    update public.project_invoice_plan_items
    set invoice_id = '70000000-0000-4000-8000-000000000001'
    where id = '80000000-0000-4000-8000-000000000001';
  `, 'Invoice-plan assignment');
  const assigned = psql(`
    select payload->>'invoiceId'
    from praxis_reporting.context_page_v1(
      'invoice_plan_item', '10000000-0000-4000-8000-000000000001',
      '${beforeAssignment}', now() + interval '1 minute', null, null, null, 2
    );
  `, 'Invoice-plan changedAfter query', { reader: true, quiet: true });
  if (assigned !== '70000000-0000-4000-8000-000000000001') {
    throw new Error('changedAfter missed the later invoice-plan assignment.');
  }
  process.stdout.write('praxis-reporting-db: invoice-plan assignment freshness passed\n');

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
