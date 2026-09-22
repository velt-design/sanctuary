import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPortalActionsClient, PortalActionsClientError } from './portal-actions-client.mjs';

const token = `spa1_${'a'.repeat(64)}`;
const commandId = '00000000-0000-4000-8000-000000000001';
const identity = { version: 'portal_actions_v1', environment: 'production',
  grantId: commandId, actorUserId: '00000000-0000-4000-8000-000000000002',
  expiresAt: '2099-01-01T00:00:00Z' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
function setup(responses, overrides = {}) {
  const calls = [];
  const client = createPortalActionsClient({ baseUrl: 'https://portal.example.test', token,
    environment: 'production', fetchImpl: async (...args) => {
      calls.push(args);
      const response = responses.shift();
      return typeof response === 'function' ? response(...args) : response;
    }, ...overrides });
  return { client, calls };
}
const code = (expected) => (error) => {
  assert.ok(error instanceof PortalActionsClientError);
  assert.equal(error.code, expected);
  assert.ok(!`${error.stack}${JSON.stringify(error)}`.includes(token));
  return true;
};

test('health sends scoped credential to exact endpoint and strips extra identity fields', async () => {
  const { client, calls } = setup([json({ ...identity, secret: token })]);
  assert.deepEqual(await client.health(), identity);
  assert.equal(calls[0][0], 'https://portal.example.test/api/integrations/portal-actions/v1/connection');
  assert.equal(calls[0][1].headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[0][1].redirect, 'error');
  assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.ok(!JSON.stringify(client).includes(token));
});

test('execute rechecks identity for each action and sends only commandId', async () => {
  const { client, calls } = setup([json(identity), json({ replayed: false }), json(identity), json({ replayed: true })]);
  assert.deepEqual(await client.execute(commandId), { replayed: false });
  assert.deepEqual(await client.execute(commandId), { replayed: true });
  assert.equal(calls.length, 4);
  for (const [, options] of [calls[1], calls[3]]) {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, JSON.stringify({ commandId }));
    assert.equal(options.redirect, 'error');
  }
});

for (const patch of [{ environment: 'staging' }, { version: 'unexpected' }]) {
  test(`identity mismatch prevents mutation: ${JSON.stringify(patch)}`, async () => {
    const { client, calls } = setup([json({ ...identity, ...patch })]);
    await assert.rejects(client.execute(commandId), code('CONNECTION_MISMATCH'));
    assert.equal(calls.length, 1);
  });
}

for (const [patch, expected] of [[{ expiresAt: '2000-01-01T00:00:00Z' }, 'CONNECTION_EXPIRED'],
  [{ expiresAt: 'bad' }, 'INVALID_CONNECTION'], [{ grantId: 'bad' }, 'INVALID_CONNECTION'],
  [{ actorUserId: null }, 'INVALID_CONNECTION']]) {
  test(`invalid connection prevents mutation: ${JSON.stringify(patch)}`, async () => {
    const { client, calls } = setup([json({ ...identity, ...patch })]);
    await assert.rejects(client.execute(commandId), code(expected));
    assert.equal(calls.length, 1);
  });
}

test('projects reads fixed scoped endpoint after identity check', async () => {
  const { client, calls } = setup([json(identity), json({ projects: [] })]);
  assert.deepEqual(await client.projects(), { projects: [] });
  assert.ok(calls[1][0].endsWith('/projects'));
});

test('HTTP mutation error is sanitized and never automatically retried', async () => {
  const { client, calls } = setup([json(identity), json({ message: token }, 409)]);
  await assert.rejects(client.execute(commandId), (error) => {
    code('HTTP_ERROR')(error);
    assert.equal(error.status, 409);
    return true;
  });
  assert.equal(calls.length, 2);
});

test('transport failure is sanitized without leaking error cause', async () => {
  const { client } = setup([() => { throw new Error(`secret ${token}`); }]);
  await assert.rejects(client.health(), code('TRANSPORT_ERROR'));
});

test('timeout aborts fetch and bounds even a transport that ignores abort', async () => {
  const { client, calls } = setup([() => new Promise(() => {})], { timeoutMs: 10 });
  await assert.rejects(client.health(), code('TIMEOUT'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].signal.aborted, true);
});

test('timeout includes response body read', async () => {
  const { client } = setup([new Response(new ReadableStream({ start() {} }))], { timeoutMs: 10 });
  await assert.rejects(client.health(), code('TIMEOUT'));
});

test('ambiguous command timeout is not retried automatically', async () => {
  const { client, calls } = setup([json(identity), () => new Promise(() => {})], { timeoutMs: 10 });
  await assert.rejects(client.execute(commandId), code('TIMEOUT'));
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1].signal.aborted, true);
});

test('transport that reports a followed redirect is rejected', async () => {
  const response = json(identity);
  Object.defineProperty(response, 'redirected', { value: true });
  const { client } = setup([response]);
  await assert.rejects(client.health(), code('INVALID_RESPONSE_ORIGIN'));
});

test('redirect responses are rejected without forwarding request', async () => {
  const { client, calls } = setup([new Response(null, { status: 302, headers: { Location: 'https://other.test' } })]);
  await assert.rejects(client.health(), code('HTTP_ERROR'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].redirect, 'error');
});

test('opaque server response cannot cause unbounded data or expose invalid body errors', async () => {
  const { client } = setup([new Response(token), new Response('x'.repeat(2 * 1024 * 1024 + 1))]);
  await assert.rejects(client.health(), code('INVALID_RESPONSE'));
  await assert.rejects(client.health(), code('RESPONSE_TOO_LARGE'));
});

test('rejects caller payload overrides before any transport', async () => {
  const { client, calls } = setup([]);
  await assert.rejects(client.execute({ commandId, projectId: commandId }), code('INVALID_COMMAND_ID'));
  assert.equal(calls.length, 0);
});

test('configuration fails closed without disclosing input', () => {
  for (const baseUrl of ['http://portal.example.test', 'https://user:password@portal.example.test',
    'https://portal.example.test/path', 'https://portal.example.test/?token=secret', 'https://portal.example.test/#secret']) {
    assert.throws(() => setup([], { baseUrl }), code('INVALID_BASE_URL'));
  }
  assert.throws(() => setup([], { token: 'secret' }), code('INVALID_TOKEN'));
  assert.throws(() => setup([], { environment: 'dev' }), code('INVALID_ENVIRONMENT'));
  assert.throws(() => setup([], { timeoutMs: 60_001 }), code('INVALID_TIMEOUT'));
});

test('HTTP is limited to explicit staging loopback destinations', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.doesNotThrow(() => setup([], { baseUrl: `http://${host}:3100`, environment: 'staging' }));
    assert.throws(() => setup([], { baseUrl: `http://${host}:3100` }), code('INVALID_BASE_URL'));
  }
  assert.throws(() => setup([], { baseUrl: 'http://192.168.1.2:3100', environment: 'staging' }), code('INVALID_BASE_URL'));
});
