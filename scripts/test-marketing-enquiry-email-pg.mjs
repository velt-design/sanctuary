// Disposable PostgreSQL only. No environment URL or shared database is accepted.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { startDisposablePostgres17 } from './test-support/disposable-postgres17.mjs';

const root = path.resolve(import.meta.dirname, '..');
const local = await startDisposablePostgres17('sanctuary-enquiry-email-pg-');
const { directory, version, run, executable, args, sql } = local;
try {
  for (const file of ['supabase/tests/marketing_enquiry_email_bootstrap.sql', 'supabase/migrations/20260909000001_marketing_enquiry_email_correlation.sql']) {
    run('psql', [...args, '-1', '-f', path.join(root, file)]);
  }
  const hash = 'a'.repeat(64);
  const begin = (ref) => `select public.marketing_enquiry_email_begin('${ref}','11111111-1111-4111-8111-111111111111','21111111-1111-4111-8111-111111111111','${hash}');`;
  const execute = promisify(execFile);
  const refs = ['31111111-1111-4111-8111-111111111111', '32222222-2222-4222-8222-222222222222'];
  const races = await Promise.all(refs.map((ref) => execute(executable('psql'), [...args, '-c', `begin; set local role service_role; ${begin(ref)} select pg_sleep(0.2); commit;`], { windowsHide: true, encoding: 'utf8', timeout: 10_000 })));
  assert.deepEqual(races.map(({ stdout }) => stdout.trim()).sort(), ['f', 't']);
  const winner = sql('select reference from private.marketing_enquiry_email_intents');
  assert.ok(refs.includes(winner));
  assert.equal(sql(`set role service_role; select outcome || ':' || code from public.marketing_enquiry_email_read('${winner}');`), 'unknown:ENQUIRY_EMAIL_RECEIPT_MISSING');
  assert.equal(sql(`set role service_role; ${begin(winner)}`), 'f');
  const receipt = (id) => `select public.marketing_enquiry_email_record('${winner}','${hash}','accepted','${id}','RESEND_ACCEPTED');`;
  sql(`set role service_role; ${receipt('api-message-1')}`);
  sql(`set role service_role; ${receipt('api-message-1')}`);
  assert.throws(() => sql(`set role service_role; ${receipt('conflicting-id')}`), /ENQUIRY_EMAIL_RECEIPT_CONFLICT/);
  for (const role of ['anon', 'authenticated']) {
    assert.throws(() => sql(`set role ${role}; select * from public.marketing_enquiry_email_read('${winner}');`), /permission denied/);
  }
  assert.throws(() => sql('set role service_role; select * from private.marketing_enquiry_email_intents;'), /permission denied/);
  assert.throws(() => sql('delete from private.marketing_enquiry_email_receipts;'), /ENQUIRY_EMAIL_IMMUTABLE/);
  console.log(`${version}: independent-session claim race, crash/unknown, replay, receipt conflict and role denials passed. Synthetic cluster stopped on exit: ${directory}`);
} finally {
  local.stop();
}
