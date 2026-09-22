import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createPortalCredentialStore } from './portal-actions-credential-store.mjs';
import { runPortalActions } from '../portal-actions.mjs';

const token = `spa1_${'a'.repeat(64)}`;
const commandId = '00000000-0000-4000-8000-000000000001';
const identity = { version: 'portal_actions_v1', environment: 'staging', grantId: commandId,
  actorUserId: '00000000-0000-4000-8000-000000000002', expiresAt: '2099-01-01T00:00:00Z' };
const connection = { version: 1, baseUrl: 'https://portal.example.test', environment: 'staging', token, identity };
function fixture(initial = null) {
  let saved = initial; const calls = [];
  const store = createPortalCredentialStore({ platform: 'win32', bridge: async request => {
    calls.push(request);
    if (request.operation === 'read') return saved ?? { missing: true };
    if (request.operation === 'save') { saved = JSON.parse(request.payload); return { saved: true }; }
    if (request.operation === 'disconnect') { saved = null; return { disconnected: true }; }
    throw new Error(token);
  } });
  return { store, calls, saved: () => saved };
}
test('refuses non-Windows storage before calling the credential backend', () => {
  let calls = 0;
  assert.throws(() => createPortalCredentialStore({ platform: 'linux', bridge: () => calls++ }), { code: 'WINDOWS_REQUIRED' });
  assert.equal(calls, 0);
});
test('saves only validated connection and returns no token from storage operations', async () => {
  const { store, calls } = fixture();
  assert.equal(await store.save(connection), undefined);
  assert.deepEqual(await store.read(), connection);
  assert.deepEqual(calls.map(call => call.operation), ['read', 'save', 'read']);
  assert.ok(!JSON.stringify(store).includes(token));
});
test('invalid or wrong-environment saved configuration fails closed', async () => {
  for (const bad of [{ ...connection, environment: 'production' }, { ...connection, version: 2 },
    { ...connection, baseUrl: 'https://someone:password@example.test' }, { ...connection, token: 'bad' },
    { ...connection, identity: { ...identity, unexpected: token } }]) {
    const { store, calls } = fixture(bad);
    await assert.rejects(store.read(), { code: 'INVALID_SAVED_CONNECTION' });
    assert.deepEqual(calls.map(call => call.operation), ['read']);
  }
});
test('changing saved destination requires an explicit disconnect first', async () => {
  const { store, calls } = fixture(connection);
  for (const replacement of [{ ...connection, baseUrl: 'https://other.example.test' },
    { ...connection, environment: 'production', identity: { ...identity, environment: 'production' } }]) {
    await assert.rejects(store.save(replacement), { code: 'DISCONNECT_BEFORE_CHANGING_DESTINATION' });
  }
  assert.ok(calls.every(call => call.operation === 'read'));
});
test('storage protection or DPAPI errors are sanitized and never fall back to plaintext', async () => {
  const requests = [];
  const store = createPortalCredentialStore({ platform: 'win32', bridge: async request => {
    requests.push(request); throw new Error(`Unprotected ACL or invalid DPAPI ${token}`);
  } });
  await assert.rejects(store.save(connection), error => {
    assert.equal(error.code, 'STORAGE_UNAVAILABLE');
    assert.ok(!`${error.stack}${JSON.stringify(error)}`.includes(token)); return true;
  });
  assert.deepEqual(requests, [{ operation: 'read' }]);
});
test('disconnect uses the fixed credential operation and honestly reports no remote revocation', async () => {
  const { store, calls } = fixture(connection);
  assert.deepEqual(await store.disconnect(), { disconnected: true, serverGrantRevoked: false });
  assert.deepEqual(calls, [{ operation: 'disconnect' }]);
  assert.equal(await store.read(), null);
});

function cliFixture({ initial = connection, health = async () => identity, execute = async () => ({ committed: true }), projects = async () => ({ projects: [] }) } = {}) {
  const { store, calls, saved } = fixture(initial);
  const transport = []; const stdout = []; const stderr = [];
  const options = { input: Readable.from([`${token}\n`]), output: text => stdout.push(text), errorOutput: text => stderr.push(text),
    storeFactory: () => store, clientFactory: config => {
      transport.push(['create', config]);
      return { health: async () => { transport.push(['health']); return health(); },
        execute: async id => { transport.push(['execute', id]); return execute(id); },
        projects: async () => { transport.push(['projects']); return projects(); } };
    } };
  return { options, calls, saved, transport, stdout, stderr };
}
test('connect verifies health before persisting and outputs only non-secret metadata', async () => {
  const f = cliFixture({ initial: null });
  assert.equal(await runPortalActions(['connect', '--base-url', connection.baseUrl, '--environment', 'staging'], f.options), 0);
  assert.deepEqual(f.transport.map(call => call[0]), ['create', 'health']);
  assert.equal(f.saved().token, token);
  assert.ok(!f.stdout.join('').includes(token));
  assert.equal(JSON.parse(f.stdout.join('')).connected, true);
});
test('failed connection health never persists a credential', async () => {
  const f = cliFixture({ initial: null, health: async () => { throw new Error(token); } });
  assert.equal(await runPortalActions(['connect', '--base-url', connection.baseUrl, '--environment', 'staging'], f.options), 1);
  assert.equal(f.saved(), null);
  assert.ok(!f.stderr.join('').includes(token));
});
test('tokens cannot be passed as arguments, and invalid arguments are never echoed', async () => {
  const f = cliFixture();
  assert.equal(await runPortalActions(['connect', '--token', token], f.options), 1);
  assert.equal(f.transport.length, 0);
  assert.ok(!f.stderr.join('').includes(token));
});
test('non-raw-capable terminal or over-bound credential input is rejected before transport', async () => {
  for (const input of [Object.assign(Readable.from([token]), { isTTY: true }), Readable.from(['x'.repeat(129)])]) {
    const f = cliFixture(); f.options.input = input;
    assert.equal(await runPortalActions(['connect', '--base-url', connection.baseUrl, '--environment', 'staging'], f.options), 1);
    assert.equal(f.transport.length, 0);
  }
});

test('interactive connect uses hidden input, verifies health and persists only through injected store', async () => {
  const input = new EventEmitter(); input.isTTY = true; input.isRaw = false;
  input.setRawMode = (value) => { input.isRaw = value; }; input.resume = () => {}; input.pause = () => {};
  const f = cliFixture({ initial: null }); f.options.input = input;
  const result = runPortalActions(['connect', '--base-url', connection.baseUrl, '--environment', 'staging'], f.options);
  assert.equal(input.isRaw, true);
  input.emit('data', Buffer.from(`${token}\r\n`));
  assert.equal(await result, 0); assert.equal(input.isRaw, false);
  assert.equal(f.saved().token, token);
  assert.ok(![...f.stdout, ...f.stderr].join('').includes(token));
});

test('interactive cancellation leaves an existing connection untouched and reports cancellation', async () => {
  const input = new EventEmitter(); input.isTTY = true; input.isRaw = false;
  input.setRawMode = (value) => { input.isRaw = value; }; input.resume = () => {}; input.pause = () => {};
  const f = cliFixture(); f.options.input = input;
  const result = runPortalActions(['connect', '--base-url', connection.baseUrl, '--environment', 'staging'], f.options);
  input.emit('data', Buffer.from('\x03'));
  assert.equal(await result, 1); assert.equal(input.isRaw, false);
  assert.equal(f.transport.length, 0); assert.deepEqual(f.calls, []);
  assert.match(f.stderr.join(''), /Connection setup cancelled/);
});
test('saved identity mismatch prevents project reads and execution', async () => {
  for (const args of [['projects'], ['execute', commandId]]) {
    const f = cliFixture({ health: async () => ({ ...identity, grantId: identity.actorUserId }) });
    assert.equal(await runPortalActions(args, f.options), 1);
    assert.deepEqual(f.transport.map(call => call[0]), ['create', 'health']);
  }
});
test('execute uses exact stable command ID, reports durable receipt and redacts secret-shaped response values', async () => {
  const f = cliFixture({ execute: async () => ({ committed: true, replayed: true, commandId, extra: token }) });
  assert.equal(await runPortalActions(['execute', commandId], f.options), 0);
  assert.deepEqual(f.transport.at(-1), ['execute', commandId]);
  assert.equal(JSON.parse(f.stdout.join('')).committed, true);
  assert.ok(!f.stdout.join('').includes(token));
});
test('ambiguous execute failure never retries and names the same command for reconciliation', async () => {
  const f = cliFixture({ execute: async () => { throw new Error(`TIMEOUT ${token}`); } });
  assert.equal(await runPortalActions(['execute', commandId], f.options), 1);
  assert.equal(f.transport.filter(call => call[0] === 'execute').length, 1);
  assert.match(f.stderr.join(''), /outcome is unverified/);
  assert.ok(f.stderr.join('').includes(commandId));
  assert.ok(!f.stderr.join('').includes(token));
});
test('disconnect performs no network request', async () => {
  const f = cliFixture();
  assert.equal(await runPortalActions(['disconnect'], f.options), 0);
  assert.equal(f.transport.length, 0);
  assert.equal(f.saved(), null);
});
test('missing stored connection fails before transport', async () => {
  const f = cliFixture({ initial: null });
  assert.equal(await runPortalActions(['health'], f.options), 1);
  assert.equal(f.transport.length, 0);
});

test('Windows current-user DPAPI round trip uses stdin and never prints plaintext', { skip: process.platform !== 'win32' }, async () => {
  const script = String.raw`$ErrorActionPreference='Stop'; $env:PSModulePath=[IO.Path]::Combine($PSHOME,'Modules'); try { $inputValue=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $inputValue -AsPlainText -Force; $encrypted=ConvertFrom-SecureString $secure; $restored=ConvertTo-SecureString $encrypted; $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($restored); try { if ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -cne $inputValue -or $encrypted.Contains($inputValue)) { exit 1 }; [Console]::Out.Write('round-trip-ok') } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose(); $restored.Dispose() } } catch { exit 1 }`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('DPAPI timeout')); }, 10_000);
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('DPAPI unavailable')); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output }); });
    child.stdin.end(token);
  });
  assert.deepEqual(result, { code: 0, output: 'round-trip-ok' });
});
