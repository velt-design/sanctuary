// Native disposable PostgreSQL, never a supplied production connection.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const bin = process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if (!bin || !path.isAbsolute(bin)) throw new Error('Set PRAXIS_DISPOSABLE_POSTGRES_BIN to a local PostgreSQL 17 bin directory.');
const directory = mkdtempSync(path.join(tmpdir(), 'sanctuary-praxis-customer-'));
const data = path.join(directory, 'data');
const server = createServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
function run(name, args, input) {
  return spawnSync(path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`), args,
    { cwd: root, encoding: 'utf8', windowsHide: true, input, timeout: 60_000, maxBuffer: 1024 * 1024,
      stdio: name === 'pg_ctl' ? 'ignore' : 'pipe' });
}
function success(result, label) {
  if (result.error || result.status !== 0) throw new Error(`${label}: ${result.error?.message ?? result.stderr}`);
  return result.stdout?.trim() ?? '';
}
function sql(statement, reader = false, allowFailure = false) {
  const result = run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port),
    '-U', reader ? 'praxis_customer_probe' : 'postgres', '-d', 'postgres'], statement);
  if (allowFailure) return result;
  return success(result, 'SQL');
}
function count() { return sql('select count(*) from praxis_reporting.verified_receipts_v1;', true); }
function hidden(mutation) {
  // Keep mutation and assertion in one disposable transaction, then restore the fixture.
  assert.equal(sql(`begin; ${mutation}; set local role praxis_customer_probe;
    select count(*) from praxis_reporting.verified_receipts_v1; rollback;`), '0');
}
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
let started = false;
try {
  success(run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']), 'initdb');
  started = true;
  success(run('pg_ctl', ['-D', data, '-l', path.join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']), 'start');
  assert.equal(sql("select current_setting('server_version_num')::int / 10000;"), '17');
  const bootstrap = read('supabase/tests/praxis_context_reporting_bootstrap.sql');
  const start = bootstrap.indexOf('-- PGlite test double for Supabase');
  const end = bootstrap.indexOf('\n\ncreate table public.contacts', start);
  assert.ok(start >= 0 && end > start);
  sql(`${bootstrap.slice(0, start)}create extension pgcrypto with schema extensions;${bootstrap.slice(end)}`);
  sql(read('supabase/tests/praxis_verified_receipts_fixture.sql'));
  sql('alter table public.projects drop column version;');
  sql("alter table public.deposit_invoices add column invoice_kind text default 'QUOTE_LINKED';");
  const latestFinance = read('supabase/migrations/20260914000017_xero_partial_payment_balances.sql');
  sql(latestFinance.slice(latestFinance.indexOf('create or replace function'), latestFinance.indexOf('-- Matched money')));
  const financeDefinition = sql("select pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure);");
  const businessSnapshot = () => sql(`select jsonb_build_object(
    'quotes',(select jsonb_agg(to_jsonb(q)-'updated_at' order by id) from public.quotes q),
    'plans',(select jsonb_agg(to_jsonb(p)-'updated_at' order by id) from public.project_invoice_plan_items p),
    'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.deposit_invoices i),
    'payments',(select jsonb_agg(to_jsonb(e) order by id) from public.project_payment_entries e));`);
  const before = businessSnapshot();
  const reportingMigration = read('supabase/migrations/20260916000002_praxis_reporting_current_bootstrap.sql');
  sql(reportingMigration.replace(/commit;\s*$/, 'rollback;'));
  assert.equal(sql("select to_regclass('praxis_reporting.source_identity_v1') is null;"), 't');
  assert.equal(sql("select pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure);"), financeDefinition);
  sql(reportingMigration);
  assert.equal(businessSnapshot(), before, 'reporting installation changed business rows');
  assert.equal(sql('select count(*) from public.quotes where updated_at is not null;'), '0');
  assert.equal(sql('select count(*) from public.project_invoice_plan_items where updated_at is not null;'), '0');
  const patchedDefinition = sql("select pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure);");
  assert.equal(patchedDefinition.replace(" and not pg_has_role(session_user, 'sanctuary_praxis_reader', 'member')", ''), financeDefinition);
  sql(reportingMigration);
  assert.equal(sql("select pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure);"), patchedDefinition);
  const migration = read('supabase/migrations/20260916000003_praxis_verified_receipts.sql');
  sql(migration.replace(/commit;\s*$/, 'rollback;'));
  assert.equal(sql("select to_regclass('praxis_reporting.verified_receipts_v1') is null;"), 't');
  sql(migration);
  sql(read('supabase/migrations/20260916000005_praxis_instalment_receipts.sql'));
  sql('create role praxis_customer_probe login inherit nosuperuser nobypassrls; grant sanctuary_praxis_reader to praxis_customer_probe; alter role praxis_customer_probe set default_transaction_read_only = on;');
  const scopeCases = [['all', 'null'], ['all', "'10000000-0000-4000-8000-000000000001'"],
    ['contact', "'10000000-0000-4000-8000-000000000001'"], ['invoice', "'10000000-0000-4000-8000-000000000001'"],
    ['all', "'10000000-0000-4000-8000-000000000099'"]];
  const scopeSnapshot = () => scopeCases.map(([resource, project]) => sql(`select coalesce(jsonb_agg(to_jsonb(row) order by row.recorded_at,row.resource,row.id),'[]'::jsonb)
    from praxis_reporting.context_page_v1('${resource}',${project},null,'2099-01-01',null,null,null,101) row;`, true));
  const originalScope = scopeSnapshot();
  const scopedRead = read('supabase/migrations/20260916000004_praxis_project_read_scope.sql');
  sql(scopedRead.replace(/commit;\s*$/, 'rollback;'));
  assert.deepEqual(scopeSnapshot(), originalScope, 'scope migration rollback changed evidence');
  sql(scopedRead);
  assert.deepEqual(scopeSnapshot(), originalScope, 'early project filtering changed evidence');
  assert.equal(sql("select payload->>'acceptedTotalIncGstCents' from praxis_reporting.project_financial_truth_v1;", true), '11500');
  assert.equal(sql("select payload->>'openInvoiceIncGstCents' from praxis_reporting.project_financial_truth_v1;", true), '0');
  assert.equal(sql(`begin; update public.deposit_invoices set invoice_kind='STANDALONE';
    set local role praxis_customer_probe;
    select payload->>'acceptedTotalIncGstCents' from praxis_reporting.project_financial_truth_v1; rollback;`), '17250');
  assert.equal(sql("select count(*) from praxis_reporting.quotes_v1 where recorded_at is not null;", true), '1');
  assert.equal(sql("select count(*) from praxis_reporting.invoice_plan_items_v1 where recorded_at is not null;", true), '1');
  assert.equal(count(), '1');
  assert.equal(sql(`begin; update public.project_payment_entries set source_invoice_id=null;
    set local role praxis_customer_probe; select count(*) from praxis_reporting.verified_receipts_v1; rollback;`), '1');
  assert.equal(sql(`begin; update public.project_payment_entries set source_invoice_id=null;
    delete from public.xero_deposit_matches; set local role praxis_customer_probe;
    select count(*) from praxis_reporting.verified_receipts_v1; rollback;`), '0');
  assert.equal(sql('select amount_inc_gst_cents, currency from praxis_reporting.verified_receipts_v1;', true), '5750|NZD');
  hidden('update public.xero_deposit_matches set reversed_at = now()');
  hidden('update public.xero_deposit_matches set amount_inc_gst_cents = 1');
  hidden("update public.xero_deposit_matches set project_id = '10000000-0000-4000-8000-000000000002'");
  hidden("update public.project_payment_entries set source_invoice_id = '70000000-0000-4000-8000-000000000002'");
  hidden("insert into public.project_payment_entries (id,project_id,entry_type,amount_inc_gst_cents,occurred_at,created_at,reverses_entry_id) values ('90000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','REVERSAL',5750,now(),now(),'90000000-0000-4000-8000-000000000001')");
  assert.equal(sql(`select count(*) from praxis_reporting.projects_v1 p join praxis_reporting.contacts_v1 c
    on c.id::text=p.payload->>'contactId' where strpos(lower(c.payload->>'name'),'ada')>0;`, true), '1');
  for (const statement of [
    'select * from public.xero_deposit_matches',
    'select * from public.project_payment_entries',
    'delete from praxis_reporting.verified_receipts_v1',
    'update public.deposit_invoices set status=\'PAID\'',
    "select * from public.commercial_project_financial_truth('10000000-0000-4000-8000-000000000001')",
  ]) {
    const denied = sql(`set default_transaction_read_only=off; ${statement};`, true, true);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /permission denied|not automatically updatable/i);
  }
  assert.equal(sql("select has_table_privilege('anon','praxis_reporting.verified_receipts_v1','select') or has_table_privilege('authenticated','praxis_reporting.verified_receipts_v1','select') or has_table_privilege('service_role','praxis_reporting.verified_receipts_v1','select');"), 'f');
  const unknownFinance = financeDefinition.replace("if auth.role() <> 'service_role' and not public.has_portal_access() then", 'if true then');
  sql(unknownFinance);
  const rejected = sql(reportingMigration, false, true);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Finance authorization changed/);
  assert.equal(sql("select pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure);"), unknownFinance);
  sql(patchedDefinition);
  assert.equal(businessSnapshot(), before);
  console.log('PASS: PostgreSQL 17 current reporting installation without business backfill, unchanged finance calculation, rollback/idempotence/unknown-auth rejection, customer lookup, receipt identity/reversal/amount checks and reporting-only grants.');
} finally {
  if (started) success(run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']), 'stop');
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('sanctuary-praxis-customer-')) throw new Error('Unsafe cleanup path.');
  rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
