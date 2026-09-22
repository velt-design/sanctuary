// Real PostgreSQL locking with the exact grant migration and synthetic core.
// No live credentials, external services, host port, or automatic image pull.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ACTOR, PROJECT, bootstrap, reset, execute, revoke, evidence } from './lib/portal-actions-db-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const image = 'postgres:17-alpine';
const name = `sanctuary-portal-actions-test-${process.pid}-${Date.now()}`;
const migration = readFileSync(path.join(root, 'supabase/migrations/20260922042402_portal_action_grants.sql'), 'utf8');
const sessions = new Set();
let created = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 20_000 });
  if (result.error || result.status !== 0) throw new Error(`Disposable database command failed: ${result.error?.message || result.stderr}`);
  return result.stdout.trim();
}

function session(label) {
  const child = spawn('docker', ['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] });
  sessions.add(child);
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => child.kill(), 25_000);
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.on('error', () => {}); // The close result owns failures, including broken stdin after SQL errors.
  const result = new Promise((resolve) => {
    child.on('error', (error) => { stderr += error.message; });
    child.on('close', (status) => {
      clearTimeout(timeout);
      sessions.delete(child);
      resolve({ status, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
  child.stdin.write(`set application_name='${label}';set statement_timeout='15s';set lock_timeout='12s';\n`);
  return { child, result, output: () => stdout };
}

async function query(sql, label = 'inspection') {
  const job = session(label);
  job.child.stdin.end(`${sql}\n`);
  return job.result;
}
async function success(sql, label) {
  const result = await query(sql, label);
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout;
}
async function waitFor(check, label, timeout = 8_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function holder(sql) {
  const job = session('held_boundary');
  job.child.stdin.write(`begin;${sql}\n\\echo BOUNDARY_HELD\n`);
  await waitFor(() => job.output().includes('BOUNDARY_HELD'), 'boundary lock');
  return async () => {
    job.child.stdin.end('commit;\n');
    const result = await job.result;
    assert.equal(result.status, 0, result.stderr);
  };
}
async function blocked(label) {
  await waitFor(async () => (await success(`select count(*) from pg_stat_activity where application_name='${label}' and wait_event_type='Lock';`, 'lock_inspection')) === '1', `${label} lock wait`);
}
const run = (sql, label) => query(sql, label);
const state = async () => JSON.parse(await success(evidence, 'effect_evidence'));
const expected = (writes) => ({ calls: writes, receipts: writes, domainReceipts: writes,
  state: writes ? 'CLOSED' : 'ACTIVE', rowVersion: writes + 1 });
const report = (label) => process.stdout.write(`portal-actions-concurrency: ${label} passed\n`);

try {
  docker(['image', 'inspect', image]);
  docker(['run', '--detach', '--pull=never', '--network=none', '--name', name,
    '--env', 'POSTGRES_PASSWORD=synthetic-portal-actions-only', image]);
  created = true;
  await waitFor(() => {
    const probe = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 5_000 });
    return probe.status === 0;
  }, 'PostgreSQL readiness', 30_000);
  const version = await success("select current_setting('server_version_num');", 'database_identity');
  assert.equal(Math.trunc(Number(version) / 10_000), 17);
  process.stdout.write(`portal-actions-concurrency: PostgreSQL ${version}, image ${docker(['inspect', '--format', '{{.Image}}', name])}\n`);
  await success(bootstrap, 'synthetic_bootstrap');
  await success(migration, 'exact_migration');

  await success(reset, 'reset_duplicate');
  {
    const release = await holder(`select 1 from public.project_operational_states where project_id='${PROJECT}' for update;`);
    const first = run(execute, 'duplicate_first');
    await blocked('duplicate_first');
    const second = run(execute, 'duplicate_second');
    await blocked('duplicate_second');
    await release();
    const results = await Promise.all([first, second]);
    results.forEach((result) => assert.equal(result.status, 0, result.stderr));
    const [committed, replayed] = results.map((result) => JSON.parse(result.stdout));
    assert.equal(committed.replayed, false);
    assert.deepEqual(replayed, { ...committed, replayed: true });
    assert.deepEqual(await state(), expected(1));
    report('simultaneous duplicate executes produce one core write and stable replay');
  }

  for (const change of ['revoke', 'demote']) {
    await success(reset, `reset_${change}`);
    const grantId = await success('select id from private.portal_action_grants;', 'grant_identity');
    const release = await holder(`select 1 from public.project_operational_states where project_id='${PROJECT}' for update;`);
    const command = run(execute, `${change}_command`);
    await blocked(`${change}_command`);
    const changeSql = change === 'revoke' ? `set synthetic.grant_id='${grantId}';${revoke}` : `update public.portal_users set role='staff' where user_id='${ACTOR}';`;
    const authorityChange = run(changeSql, `${change}_authority`);
    await blocked(`${change}_authority`);
    await release();
    const results = await Promise.all([command, authorityChange]);
    results.forEach((result) => assert.equal(result.status, 0, result.stderr));
    assert.deepEqual(await state(), expected(1));
    const after = await query(execute, `${change}_after`);
    assert.notEqual(after.status, 0);
    assert.match(after.stderr, /42501/);
    report(`${change} waits for in-flight commit and denies subsequent replay`);
  }

  await success(reset, 'reset_stage');
  {
    const release = await holder(`update public.projects set pipeline_stage='CONFIRMED' where id='${PROJECT}';`);
    const command = run(execute, 'stage_command');
    await blocked('stage_command');
    await release();
    const result = await command;
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PT409/);
    assert.deepEqual(await state(), expected(0));
    report('concurrent advance into confirmed prevents closure');
  }

  for (const boundary of ['project', 'state']) {
    await success(reset, `reset_expiry_${boundary}`);
    const table = boundary === 'project' ? 'projects' : 'project_operational_states';
    const key = boundary === 'project' ? 'id' : 'project_id';
    const release = await holder(`select 1 from public.${table} where ${key}='${PROJECT}' for update;`);
    await success("update private.portal_action_approvals set expires_at=clock_timestamp()+interval '2 seconds';", 'short_approval');
    const command = run(execute, `expiry_${boundary}_command`);
    await blocked(`expiry_${boundary}_command`);
    await waitFor(async () => (await success('select bool_and(expires_at < clock_timestamp()) from private.portal_action_approvals;', 'expiry_clock')) === 't', 'approval expiry');
    await release();
    const result = await command;
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /42501/);
    assert.deepEqual(await state(), expected(0));
    report(`approval expiry while waiting for ${boundary} lock prevents writes`);
  }

  await success(reset, 'reset_failure');
  {
    const result = await query(`set synthetic.fail_core='true';${execute}`, 'core_failure');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /P0001/);
    assert.deepEqual(await state(), expected(0));
    assert.equal((await query(execute, 'retry_rolled_back')).status, 0);
    assert.deepEqual(await state(), expected(1));
    report('core failure rolls back every write and permits exact retry');
  }
  process.stdout.write('portal-actions-concurrency: 7 real PostgreSQL boundary scenarios passed; synthetic core only.\n');
} finally {
  for (const child of sessions) child.kill();
  if (created) docker(['rm', '--force', name]);
}
