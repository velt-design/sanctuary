// Fixed local test cluster only. No shared database URL is accepted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

export async function startDisposablePostgres17(prefix) {
  const bin = process.env.SANCTUARY_TEST_PG_BIN;
  if (!bin || !path.isAbsolute(bin)) throw new Error('Set SANCTUARY_TEST_PG_BIN to an absolute local PostgreSQL bin directory.');
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  const data = path.join(directory, 'data');
  const executable = (name) => path.join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
  const run = (name, args) => execFileSync(executable(name), args, {
    windowsHide: true, encoding: 'utf8', timeout: 30_000,
    ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}),
  });
  const version = run('postgres', ['--version']).trim();
  assert.match(version, /PostgreSQL\) 17\./);
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  const args = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'];
  const stop = () => run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  try {
    run('pg_ctl', ['-D', data, '-l', path.join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  } catch (error) {
    try { stop(); } catch { /* Retain startup diagnostics in the test directory. */ }
    throw error;
  }
  return { directory, port, version, run, executable, args, stop,
    sql: (statement) => execFileSync(executable('psql'), args, {
      windowsHide: true, encoding: 'utf8', timeout: 30_000, input: statement,
    }).trim() };
}
