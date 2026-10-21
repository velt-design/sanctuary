// Disposable local native substrate. Never pulls an image, exposes a port or reads a remote database.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const image = 'public.ecr.aws/supabase/postgres:17.6.1.167';
const container = `sanctuary-ga4-v3-${process.pid}-${Date.now()}`;
const bin = process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if (bin && !path.isAbsolute(bin)) throw Error('The existing native binary path must be absolute.');
const directory = bin ? mkdtempSync(path.join(tmpdir(), 'sanctuary-ga4-v3-')) : null;
const data = directory && path.join(directory, 'data');
const socket = bin ? createServer() : null;
if (socket) await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket?.address().port;
if (socket) await new Promise(resolve => socket.close(resolve));
function native(name, args, input) {
  const result = spawnSync(path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`), args, {
    input, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe' });
  if (result.status !== 0 || result.error) throw Error(result.error?.message ?? result.stderr ?? `${name} failed`);
  return result.stdout?.trim() ?? '';
}
const base = readFileSync(new URL('../supabase/migrations/20260923070001_sanctuary_ga4_reporting.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261021040001_ga4_v3_diagnostics.sql', import.meta.url), 'utf8');
const actor = '10000000-0000-4000-8000-000000000001', connection = '20000000-0000-4000-8000-000000000001', binding = 'a'.repeat(64), vaultId = 'a'.repeat(26), itemId = 'b'.repeat(26);
const query = { period: { start: '2026-10-01', end: '2026-10-02' }, comparison: { start: '2026-09-29', end: '2026-09-30' } };
const literal = value => value === null ? 'null' : `'${String(typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''")}'`;
function docker(args, input) { const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }); if (result.status !== 0) throw Error(result.stderr || result.error?.message || 'Docker failed'); return result.stdout.trim(); }
function sql(body, database = 'postgres') { return bin ? native('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', database], body)
  : docker(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], "load 'safeupdate';\n" + body); }
const statement = (action, operation = null, input = {}) => `select public.sanctuary_ga4_command(${[actor, '123', binding, 'synthetic', connection, 'test', action, operation, input.query ?? null, input.step ?? null, input.evidence ?? null, input.payload ?? null].map(literal).join(',')});`;
const command = (database, action, operation = null, input = {}) => JSON.parse(sql('set role service_role;' + statement(action, operation, input), database));
function boundary(database, operation, step, before = {}, after = before) { command(database, 'before', operation, { step, evidence: before }); command(database, 'after', operation, { step, evidence: after }); }
const quality = { sampled: false, thresholded: false, otherRowLoss: false, provisional: false, comparisonsAllowed: true };
const diagnostics = () => ({ version: 'sanctuary-ga4-v3', firstEditCompleteFrom: null, stageUnit: 'event_occurrences', stagesQuality: quality,
  stages: ['contact_form_interaction', 'contact_start', 'contact_success'].map((event, index) => ({ event, count: { value: [37, 21, 13][index], previous: null } })),
  acquisition: { status: 'unavailable', reason: 'row_limit' }, orderedFunnel: { status: 'unavailable', reason: 'source_capability_unproven', unit: 'active_users' } });
let index = 0;
function fixture() { const name = `ga4_case_${++index}`; sql(`create database ${name} template ga4_template`); return name; }
function ready(database, version = 'sanctuary-ga4-v3', mutate = value => value) {
  const operation = command(database, 'claim', null, { query, ...(version === 'sanctuary-ga4-v3' ? { evidence: { reportVersion: version } } : {}) }).operation;
  boundary(database, operation, 'vault_auth'); boundary(database, operation, 'vault_read', { vaultId, itemId }, { vaultId, itemId, afterVersion: 3 });
  boundary(database, operation, 'token_refresh', {}, { scope: 'https://www.googleapis.com/auth/analytics.readonly', expiresIn: 3600, refreshRotated: false });
  boundary(database, operation, 'property_read', { property: '123' });
  const report = mutate({ source: 'ga4', property: '123', timezone: 'Pacific/Auckland', fetchedAt: new Date().toISOString(), query, traffic: [], channels: [], landing: [], events: [], sessions: null, previousSessions: null, warnings: [], ...(version === 'sanctuary-ga4-v3' ? { diagnostics: diagnostics() } : {}) });
  const payload = JSON.stringify(report), hash = createHash('sha256').update(payload).digest('hex');
  const extraRows = report.diagnostics?.acquisition.status === 'available' || report.diagnostics?.acquisition.status === 'limited' ? report.diagnostics.acquisition.rows.length : 0;
  const intent = { property: '123', queryHash: 'c'.repeat(64), reportVersion: version, startDate: query.period.start, endDate: query.period.end, comparisonStart: query.comparison.start, comparisonEnd: query.comparison.end };
  boundary(database, operation, 'report_read', intent, { ...intent, reportOutcome: 'complete', resultHash: hash, rowCount: version === 'sanctuary-ga4-v3' ? 3 + extraRows : 0, warningCount: 0, timezone: report.timezone });
  command(database, 'finish', operation, { evidence: { outcome: 'connected' } }); return { operation, payload, hash, report };
}
let started = false;
try {
  let imageId = null;
  if (bin) {
    native('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    native('pg_ctl', ['-D', data, '-l', path.join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
  } else {
    imageId = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    docker(['run', '--detach', '--rm', '--pull=never', '--network', 'none', '--name', container, '--user', 'postgres', '--entrypoint', 'sh', image, '-c',
      'initdb -D /tmp/ga4-proof -U postgres --auth=trust >/dev/null && exec postgres -D /tmp/ga4-proof']); started = true;
  }
  let available = false; for (let attempt = 0; attempt < 60; attempt++) { try { sql('select 1'); available = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); } }
  assert.ok(available, 'Local PostgreSQL started'); const postgres = sql('show server_version'); assert.match(postgres, /^17\./);
  sql('create database ga4_template');
  sql(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
create schema auth;create schema private;create schema praxis_reporting;create schema cron;
create function cron.schedule(text,text,text)returns integer language sql as 'select 1';
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
create table public.portal_users(user_id uuid primary key,role text);
create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);
insert into auth.users values('${actor}',now(),null,null);insert into public.portal_users values('${actor}','staff');
insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${connection}','test');`, 'ga4_template');
  sql(base, 'ga4_template'); sql(migration, 'ga4_template');
  sql(`insert into private.sanctuary_ga4_control(actor_id,property_id,binding_hash,vault_id,item_id,expires_at,source_key,connection_id,environment)
values('${actor}','123','${binding}','${vaultId}','${itemId}',now()+interval '1 day','synthetic','${connection}','test');`, 'ga4_template');
  assert.throws(() => command('ga4_template', 'claim', null, { query }), /authority unavailable/);
  for (const role of ['anon', 'authenticated', 'praxis_reporting']) assert.throws(() => sql(`set role ${role};` + statement('read'), 'ga4_template'), /permission denied/);
  assert.throws(() => sql('set role service_role;select * from private.sanctuary_ga4_snapshot', 'ga4_template'), /permission denied/);
  if (!bin) assert.throws(() => sql('delete from private.sanctuary_ga4_snapshot', 'ga4_template'), /WHERE clause/);
  sql('update private.sanctuary_ga4_control set enabled=true where singleton=true', 'ga4_template');
  for (const version of ['sanctuary-ga4-v2', 'sanctuary-ga4-v3']) {
    const database = fixture(), value = ready(database, version); command(database, 'complete', value.operation, { payload: value.payload });
    const saved = command(database, 'read'); assert.equal(saved.resultHash, value.hash); assert.deepEqual(JSON.parse(saved.payload), value.report);
    assert.equal(Date.parse(saved.expiresAt) - Date.parse(value.report.fetchedAt), 7 * 86400000);
    sql(`update private.sanctuary_ga4_operations set expires_at=now()-interval '1 minute' where id='${value.operation}'`, database);
    command(database, 'deliver', value.operation); command(database, 'delete'); assert.equal(command(database, 'read').status, 'missing');
    assert.throws(() => command(database, 'deliver', value.operation), /delivery unavailable/);
  }
  const availableDatabase = fixture(), availableValue = ready(availableDatabase, 'sanctuary-ga4-v3', value => {
    value.diagnostics.acquisition = { status: 'available', dimensions: ['sessionSourceMedium', 'landingPage', 'deviceCategory'], sessionUnit: 'sessions', eventUnit: 'event_occurrences', quality,
      rows: [{ sourceMedium: 'google / organic', landingPath: '/pergolas', deviceCategory: 'desktop', sessions: { value: 0, previous: 2 }, firstEdits: { value: null, previous: null }, submitAttempts: { value: 1, previous: 0 }, acceptedSuccesses: { value: 0, previous: 0 } }] };
    return value;
  });
  command(availableDatabase, 'complete', availableValue.operation, { payload: availableValue.payload });
  assert.deepEqual(JSON.parse(command(availableDatabase, 'read').payload), availableValue.report);
  for (const mutate of [value => { value.diagnostics.acquisition.rows = []; return value; }, value => { value.diagnostics.stages[0].count.value = -1; return value; },
    value => { value.diagnostics.firstEditCompleteFrom = '2026-09-17'; return value; }, value => { value.diagnostics.orderedFunnel.status = 'available'; return value; }]) {
    const database = fixture(), value = ready(database, 'sanctuary-ga4-v3', mutate); assert.throws(() => command(database, 'complete', value.operation, { payload: value.payload }), /diagnostic version or shape/);
  }
  const hashDatabase = fixture(), hashValue = ready(hashDatabase); assert.throws(() => command(hashDatabase, 'complete', hashValue.operation, { payload: hashValue.payload.replace('"value":37', '"value":38') }), /association unavailable/);
  const deleteDatabase = fixture(), deleted = ready(deleteDatabase); command(deleteDatabase, 'delete'); assert.throws(() => command(deleteDatabase, 'complete', deleted.operation, { payload: deleted.payload }), /not ready/);
  const stopDatabase = fixture(), stopped = ready(stopDatabase); sql('update private.sanctuary_ga4_control set enabled=false where singleton=true', stopDatabase); assert.throws(() => command(stopDatabase, 'complete', stopped.operation, { payload: stopped.payload }), /authority unavailable/);
  const versionDatabase = fixture(), versionValue = ready(versionDatabase, 'sanctuary-ga4-v2'); const changed = JSON.stringify({ ...versionValue.report, diagnostics: diagnostics() }); assert.throws(() => command(versionDatabase, 'complete', versionValue.operation, { payload: changed }), /diagnostic version or shape/);
  console.log(JSON.stringify({ status: 'passed', postgres, imageId, safeupdate: !bin, safeupdateGate: bin ? 'UNVERIFIED: installed native package has no safeupdate extension; no fake substitute used' : 'passed', databases: index, baseSha256: createHash('sha256').update(base).digest('hex'), migrationSha256: createHash('sha256').update(migration).digest('hex'),
    checks: ['native DDL and v2 compatibility', 'RPC-only roles', ...(!bin ? ['real safeupdate'] : []), 'claim/intent version', 'strict diagnostics and unavailable union', 'payload hash association', 'seven-day retention and expired writer delivery', 'delete and control fencing'],
    limits: ['synthetic auth/source prerequisites and cron stub, not full Sanctuary schema', 'no real pg_cron scheduling or HTTP/provider/vault call', 'PGlite HTTP composition is a separate receipt', ...(bin ? ['safeupdate unavailable in this native binary distribution'] : [])], network: bin ? 'disposable loopback only' : 'none', hostMounts: false, publishedPorts: false }));
} finally {
  if (started) { if (bin) native('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']); else docker(['rm', '--force', container]); }
  if (directory) { const resolved = path.resolve(directory); if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('Unsafe temporary cleanup'); rmSync(resolved, { recursive: true, force: true }); }
}
