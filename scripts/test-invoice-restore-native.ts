/** Disposable Docker PostgreSQL only; synthetic prerequisites, production command bodies. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { initialiseInvoiceRestoreDatabase } from '../test/support/invoiceDatabase';

const container = `sanctuary-invoice-restore-${process.pid}-${Date.now()}`;
const project = '10000000-0000-4000-8000-000000000001';
const invoice = '40000000-0000-4000-8000-000000000001';
const command = '50000000-0000-4000-8000-000000000002';
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
function docker(args: string[], input?: string) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker failed');
  return result.stdout.trim();
}
const args = (db: string) => ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db];
const sql = (body: string, db = 'postgres') => docker(args(db), body);
async function until(check: () => boolean, label: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out: ${label}`);
}
function session(db: string, name: string) {
  const child = spawn('docker', args(db), { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let out = '', err = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.stderr.on('data', (chunk) => { err += chunk; });
  const done = new Promise<{ code: number | null; out: string; err: string }>((resolve) => child.on('exit', (code) => resolve({ code, out, err })));
  child.stdin.write(`set application_name=${literal(name)};set lock_timeout='10s';set statement_timeout='15s';\n`);
  return { send: (body: string) => child.stdin.write(body + '\n'), end: () => child.stdin.end(), done };
}
async function competing(db: string, firstSql: string, secondSql: string, expectedFailure?: RegExp) {
  const first = session(db, 'invoice-first'), second = session(db, 'invoice-second');
  try {
    first.send('begin;' + firstSql);
    await until(() => sql("select count(*) from pg_stat_activity where application_name='invoice-first' and state='idle in transaction'", db) === '1', 'first command holds real transaction locks');
    second.send(secondSql); second.end();
    await until(() => sql("select count(*) from pg_stat_activity where application_name='invoice-second' and wait_event_type='Lock'", db) === '1', 'second connection actually waits for first');
    first.send('commit;'); first.end();
    const firstResult = await first.done;
    assert.equal(firstResult.code, 0, firstResult.err);
    const result = await second.done;
    if (expectedFailure) { assert.notEqual(result.code, 0); assert.match(result.err, expectedFailure); }
    else assert.equal(result.code, 0, result.err);
  } finally { first.end(); second.end(); }
}
const voidInvoice = `select public.commercial_void_open_invoice('${invoice}','synthetic-admin','Accidental void');`;
const prepare = (key = `deposit-invoice-send:${invoice}`) => `select id from public.commercial_email_prepare('${key}','deposit_invoice_send','${invoice}','${project}',repeat('a',64),'{}'::jsonb,now()+interval '1 hour');`;
const dispatch = (id: string) => `select public.commercial_email_mark_dispatching('${id}');`;
const fixture = (name: string) => { sql(`create database ${name} template invoice_template`); return name; };
const restore = (db: string) => `select public.commercial_restore_invoice('${invoice}',${literal(sql(`select voided_at::text from public.deposit_invoices where id='${invoice}'`, db))},'${command}','Voided by mistake','synthetic-admin');`;

async function main() {
  let created = false;
  try {
    docker(['run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
    created = true;
    // Docker's temporary init server accepts Unix sockets before restarting.
    // Only the final server listens on TCP; use that same endpoint for all SQL.
    await until(() => { try { return docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).includes('accepting'); } catch { return false; } }, 'PostgreSQL TCP startup');
    await initialiseInvoiceRestoreDatabase({ exec: async (body: string) => sql(body) });
    const content = { version: 1, items: [{ id: '60000000-0000-4000-8000-000000000001', description: 'Synthetic work', qty: 1, unitPriceIncGstCents: 11500, lineTotalIncGstCents: 11500 }], billingName: 'Synthetic', billingEmail: 'test@example.invalid', billingAddress: '', notes: '' };
    const schedule = { mode: 'custom', label: 'Invoice', dueDate: '2026-10-30', amountIncGstCents: 11500 };
    sql(`insert into public.projects(id,name) values('${project}','Synthetic concurrency');
      insert into public.project_operational_states(project_id,state) values('${project}','ACTIVE');
      select public.commercial_invoice_save_draft('${invoice}','${project}',0,null,${literal(JSON.stringify(content))},${literal(JSON.stringify(schedule))});
      select public.commercial_invoice_issue_draft('${invoice}',1,'50000000-0000-4000-8000-000000000001','Synthetic bank');
      create database invoice_template template postgres;`);

    const stale = fixture('restore_before_prepare');
    sql(voidInvoice, stale);
    await competing(stale, restore(stale), prepare(), /Invoice changed before sending/i);
    assert.equal(sql('select count(*) from private.commercial_email_intents', stale), '0');

    const replay = fixture('concurrent_restore');
    sql(voidInvoice, replay);
    const replayCommand = restore(replay);
    await competing(replay, replayCommand, replayCommand);
    assert.equal(sql("select count(*) from public.audit_events where type='invoice.restored'", replay), '1');

    const voidFirst = fixture('void_before_dispatch');
    const oldIntent = sql(prepare(), voidFirst);
    await competing(voidFirst, voidInvoice, dispatch(oldIntent), /Invoice changed before sending/i);
    sql(restore(voidFirst), voidFirst);
    assert.equal(sql(`select status from private.commercial_email_intents where id='${oldIntent}'`, voidFirst), 'cancelled');
    const fresh = sql(prepare(`deposit-invoice-send:${invoice}:restore:${command}`), voidFirst);
    sql(dispatch(fresh), voidFirst);
    assert.equal(sql(`select status from private.commercial_email_intents where id='${fresh}'`, voidFirst), 'dispatching');

    const dispatchFirst = fixture('dispatch_before_void');
    const activeIntent = sql(prepare(), dispatchFirst);
    await competing(dispatchFirst, dispatch(activeIntent), voidInvoice, /delivery is still being confirmed/i);
    assert.equal(sql(`select status from public.deposit_invoices where id='${invoice}'`, dispatchFirst), 'OPEN');
    console.log('invoice-restore-native: PASS (real lock waits: restore/stale prepare, duplicate restore, void/dispatch, dispatch/void; unsent cancellation and new generation dispatch)');
  } finally { if (created) docker(['rm', '-f', container]); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
