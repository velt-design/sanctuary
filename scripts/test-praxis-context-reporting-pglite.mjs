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

  const beforeAssignment = await database.query(`
    select updated_at from public.project_invoice_plan_items
    where id = '80000000-0000-4000-8000-000000000001'
  `);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await database.exec(`
    update public.project_invoice_plan_items
    set invoice_id = '70000000-0000-4000-8000-000000000001'
    where id = '80000000-0000-4000-8000-000000000001';
  `);
  const assigned = await database.query(`
    select payload from praxis_reporting.context_page_v1(
      'invoice_plan_item', '10000000-0000-4000-8000-000000000001',
      '${new Date(beforeAssignment.rows[0].updated_at).toISOString()}', now() + interval '1 minute',
      null, null, null, 2
    )
  `);
  requireCondition(
    assigned.rows[0]?.payload?.invoiceId === '70000000-0000-4000-8000-000000000001',
    'changedAfter missed the later invoice-plan assignment.',
  );
  process.stdout.write('praxis-context-db: invoice-plan assignment freshness passed\n');

  await database.exec(`
    create role sanctuary_praxis_reader_probe login inherit
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant sanctuary_praxis_reader to sanctuary_praxis_reader_probe;
    alter role sanctuary_praxis_reader_probe set default_transaction_read_only = on;
    set session authorization sanctuary_praxis_reader_probe;
    set default_transaction_read_only = on;
  `);
  const page = await database.query(`
    select resource, payload, record_version, policy_version,
      redaction_count, omission_count, redaction_categories
    from praxis_reporting.context_page_v1(
      'all', '10000000-0000-4000-8000-000000000001', null, now() + interval '1 minute',
      null, null, null, 100
    )
  `);
  requireCondition(page.rows.some((row) => row.resource === 'project_financial_truth'), 'Canonical financial truth is not readable.');
  const resources = [...new Set(page.rows.map((row) => row.resource))].sort();
  requireCondition(JSON.stringify(resources) === JSON.stringify([
    'contact', 'enquiry_request', 'estimate', 'invoice', 'invoice_plan_item',
    'payment', 'payment_allocation', 'project', 'project_financial_truth',
    'quote', 'quote_line_item', 'quote_version',
  ]), `Expected all 12 resources, received ${resources.join(', ')}.`);
  const serialized = JSON.stringify(page.rows);
  requireCondition(serialized.includes('attachmentSide') && serialized.includes('rear'), 'Safe nested estimate shape was not preserved.');
  requireCondition(serialized.includes('commercialInputHash') && serialized.includes('d'.repeat(64)), 'Approved commercial integrity hash was not preserved.');
  requireCondition(serialized.includes('[redacted]'), 'Free-text credential values were not redacted.');
  requireCondition(page.rows.some((row) => row.redaction_count > 0 && JSON.stringify(row.redaction_categories).includes('credential_value')), 'Redaction evidence was not emitted.');
  for (const forbidden of [
    'secret-token-hash', 'raw_payload', 'commercial_design_input', 'protected_payload',
    'encrypted_password', 'path_tokens', 'nested-enquiry-secret', 'private/enquiry.pdf',
    'nested-utm-secret', 'private-provider-id', 'nested-summary-secret',
    'nested-input-secret', 'private/design.pdf', 'nested-output-secret',
    'nested-warning-secret', 'nested-metadata-secret', 'nested-token-hash', 'private-commercial-design',
    'private-invoice-token-hash',
  ]) {
    requireCondition(!serialized.includes(forbidden), `Projection exposed forbidden material: ${forbidden}`);
  }
  process.stdout.write('praxis-context-db: bounded projection and exclusion contract passed\n');

  const bounds = await database.query(`
    with cases(label, input) as (values
      ('entries_exact', jsonb_build_object('items', (select jsonb_agg(value) from generate_series(1, 255) value))),
      ('entries_over', jsonb_build_object('items', (select jsonb_agg(value) from generate_series(1, 256) value))),
      ('bytes_exact', jsonb_build_object('a', repeat('x', 65527))),
      ('bytes_over', jsonb_build_object('a', repeat('x', 65528))),
      ('depth_exact', '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":"ok"}}}}}}}}'::jsonb),
      ('depth_over', '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":"too-deep"}}}}}}}}}'::jsonb)
    )
    select label, payload, octet_length(convert_to(payload::text, 'UTF8')) as payload_bytes,
      omission_count, categories
    from cases cross join lateral praxis_reporting.safe_payload_v1(input)
    order by label
  `);
  const bound = Object.fromEntries(bounds.rows.map((row) => [row.label, row]));
  requireCondition(bound.entries_exact.payload.items.length === 255 && bound.entries_exact.omission_count === 0, 'Aggregate child-entry boundary failed.');
  requireCondition(bound.entries_over.payload.items?._praxisOmitted === 'source_bounds_v1' && bound.entries_over.omission_count === 1, 'Aggregate child-entry boundary+1 was not omitted.');
  requireCondition(bound.bytes_exact.payload_bytes === 65536 && bound.bytes_exact.omission_count === 0, 'UTF-8 byte boundary failed.');
  requireCondition(bound.bytes_over.payload.a?._praxisOmitted === 'source_bounds_v1' && bound.bytes_over.omission_count === 1, 'UTF-8 byte boundary+1 was not omitted.');
  requireCondition(!JSON.stringify(bound.depth_exact.payload).includes('_praxisOmitted'), 'Depth boundary was omitted early.');
  requireCondition(JSON.stringify(bound.depth_over.payload).includes('source_bounds_v1') && bound.depth_over.omission_count === 1, 'Depth boundary+1 was not omitted.');

  const replacementEvidence = await database.query(`
    select payload, redaction_count, omission_count, categories
    from praxis_reporting.safe_payload_v1(jsonb_build_object(
      'a', jsonb_build_object(
        'accessToken', 'nested-secret',
        'items', (select jsonb_agg(value) from generate_series(1, 256) value),
        'padding', repeat('x', 40000)
      ),
      'b', repeat('y', 30000)
    ))
  `);
  const replacement = replacementEvidence.rows[0];
  requireCondition(
    replacement.payload.a?._praxisOmitted === 'source_bounds_v1' &&
      replacement.payload.b.length === 30000 &&
      replacement.redaction_count === 0 &&
      replacement.omission_count === 1 &&
      JSON.stringify(replacement.categories) === JSON.stringify(['source_bounds']),
    'Final size replacement retained stale nested projection evidence.',
  );
  process.stdout.write('praxis-context-db: source JSON boundary and evidence contract passed\n');

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
