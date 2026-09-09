// Independent PostgreSQL sessions in a disposable local cluster; no shared URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { verifyEnquiryIdentitySnapshot } from './test-support/enquiry-identity-snapshot.mjs';
import { startDisposablePostgres17 } from './test-support/disposable-postgres17.mjs';

const root = path.resolve(import.meta.dirname, '..');
const local = await startDisposablePostgres17('sanctuary-enquiry-identity-pg-');
const load = (file) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
let admin; let reader;
try {
  const bootstrap = load('supabase/tests/praxis_context_reporting_bootstrap.sql');
  const start = bootstrap.indexOf('-- PGlite test double for Supabase');
  const end = bootstrap.indexOf('\n\ncreate table public.contacts', start);
  assert.ok(start >= 0 && end > start);
  local.sql(`${bootstrap.slice(0, start)}create extension pgcrypto with schema extensions;${bootstrap.slice(end)}`);
  for (const file of ['supabase/migrations/20260903000001_praxis_context_reporting_v1.sql',
    'supabase/migrations/20260909000001_marketing_enquiry_email_correlation.sql']) local.sql(load(file));
  const projection = load('supabase/migrations/20260909000002_praxis_enquiry_identity_v1.sql');
  local.sql(`begin; ${projection} rollback;`);
  assert.equal(local.sql("select to_regclass('praxis_reporting.enquiry_identities_v1') is null;"), 't');
  local.sql(projection);
  local.sql(projection);
  local.sql(load('supabase/tests/praxis_enquiry_identity.sql'));
  console.log('PostgreSQL17: shared identity/window/union/101-sentinel/privacy/write-denial contracts passed.');

  local.sql(`
    create role sanctuary_enquiry_reader_probe login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant sanctuary_praxis_reader to sanctuary_enquiry_reader_probe;
    alter role sanctuary_enquiry_reader_probe set default_transaction_read_only=on;
  `);
  const connection = { host: '127.0.0.1', port: local.port, database: 'postgres', max: 1, connect_timeout: 5, idle_timeout: 1 };
  admin = postgres({ ...connection, username: 'postgres' });
  reader = postgres({ ...connection, username: 'sanctuary_enquiry_reader_probe' });
  await verifyEnquiryIdentitySnapshot(admin, reader);
  console.log(`${local.version}: two-session stable snapshot, next-snapshot receipt visibility and actual LOGIN denials passed. ${local.directory}`);
} finally {
  await Promise.all([admin?.end({ timeout: 1 }), reader?.end({ timeout: 1 })]);
  local.stop();
}
