// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import * as dc from 'node:diagnostics_channel';
import { DocumentTransportObserver, type TransportObservation, type TransportOperation, type TransportScope } from './documentTransportDiagnostics.server';
import { prepareProxyDocumentDiagnostics, readDocumentDiagnostics } from './documentDiagnostics';
vi.mock('server-only', () => ({}));

const names = ['undici:request:create', 'undici:client:connected', 'undici:client:sendHeaders', 'undici:request:bodySent', 'undici:request:headers', 'undici:request:trailers', 'undici:request:error'];
const observers: DocumentTransportObserver[] = [], servers: Server[] = [];
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let until: number;
beforeEach(() => { until = Date.now() + 10_000; });
afterEach(async () => {
  for (const observer of observers.splice(0)) observer.dispose();
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  vi.unstubAllEnvs(); vi.restoreAllMocks();
});
function observer(...args: ConstructorParameters<typeof DocumentTransportObserver>) {
  const value = new DocumentTransportObserver(...args); observers.push(value); return value;
}
function scope(records: TransportObservation[], override: Partial<TransportScope> = {}): TransportScope {
  return { requestId: randomUUID(), until, active: () => true, emit: record => records.push(record), ...override };
}
async function fixture() {
  let connections = 0, reads = 0;
  const socketIds = new WeakMap<object, number>(), gates = new Map<string, () => void>();
  let allSeen!: () => void, abortSeen!: () => void;
  const seen = new Promise<void>(resolve => { allSeen = resolve; });
  const abortRequest = new Promise<void>(resolve => { abortSeen = resolve; });
  const server = createServer((request, response) => {
    reads++;
    const send = () => response.end(JSON.stringify({ connection: socketIds.get(request.socket), fictional: 'never-log-body' }));
    response.setHeader('content-type', 'application/json');
    if (request.url === '/abort') abortSeen();
    else if (request.url?.startsWith('/gate/')) { gates.set(request.url, send); if (gates.size === 4) allSeen(); }
    else if (request.url === '/body') {
      response.write('{"fictional":');
      const timer = setTimeout(() => response.end('"never-log-body"}'), 55); response.on('close', () => clearTimeout(timer));
    } else if (request.url === '/pending') {
      const timer = setTimeout(send, 80); response.on('close', () => clearTimeout(timer));
    } else send();
  });
  server.on('connection', socket => socketIds.set(socket, ++connections));
  server.keepAliveTimeout = 10_000;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Expected loopback address');
  return { server, origin: `http://127.0.0.1:${address.port}`, gates, seen, abortRequest, reads: () => reads };
}
function nativeFailureForNextRequest() {
  let request: object | undefined, finish!: () => void;
  const seen = new Promise<void>(resolve => { finish = resolve; });
  const created = (message: unknown) => { request ??= (message as { request: object }).request; };
  const failed = (message: unknown) => { if (request && (message as { request: object }).request === request) finish(); };
  dc.subscribe('undici:request:create', created); dc.subscribe('undici:request:error', failed);
  return {
    async wait() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([seen, new Promise<void>((_, reject) => { timer = setTimeout(() => reject(Error('Expected the exact native request error event')), 2000); })]);
      } finally { clearTimeout(timer); }
    },
    dispose() { dc.unsubscribe('undici:request:create', created); dc.unsubscribe('undici:request:error', failed); },
  };
}
async function read(subject: DocumentTransportObserver, admitted: TransportScope, target: string, operation: TransportOperation = 'marketing.hub') {
  let raw!: Response;
  const value = await subject.observe(admitted, operation, async () => {
    raw = await fetch(target); const body = await raw.json(); return { response: raw, body };
  });
  expect(value.response).toBe(raw); await tick(); return value.body;
}

it('joins actual native fetch through the real signed Marketing scope without leaking its request inputs', async () => {
  const a = await fixture(), log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(until).toISOString(), nonce: 'A'.repeat(43) }));
  const prepared = prepareProxyDocumentDiagnostics(new Request('https://portal.example/staff/marketing-performance?private=never-log-query', { headers: { accept: 'text/html', 'sec-fetch-dest': 'document', cookie: 'never-log-cookie' } }));
  const admitted = readDocumentDiagnostics(prepared.requestHeaders!)!;
  const body = await admitted.measure('marketing.hub', async () => (await fetch(a.origin)).json());
  expect(body.fictional).toBe('never-log-body'); expect(a.reads()).toBe(1);
  const transport = log.mock.calls.map(call => call[1]).filter(event => event.event === 'portal.document.transport');
  expect(transport).toEqual([expect.objectContaining({ requestId: prepared.diagnostics!.id, operation: 'marketing.hub', outcome: 'response', connection: 'new', connectMs: null })]);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/never-log|127\.0\.0\.1|nonce|carrier/);
});

it('distinguishes unknown established, proven reused and new native sockets without changing fetch/dispatcher', async () => {
  const a = await fixture(), b = await fixture(), records: TransportObservation[] = [];
  const fetchBefore = globalThis.fetch;
  const warm = await (await fetch(a.origin)).json(); await delay(10);
  const keys = Object.getOwnPropertySymbols(globalThis).filter(key => key.description?.includes('undici.globalDispatcher'));
  const globals = globalThis as typeof globalThis & Record<symbol, unknown>;
  const dispatchers = keys.map(key => [key, globals[key]] as const);
  expect(keys.length).toBeGreaterThan(0);
  const subject = observer(), admitted = scope(records);
  expect((await read(subject, admitted, a.origin)).connection).toBe(warm.connection);
  expect(records.at(-1)?.connection).toBe('unknown');
  expect((await read(subject, admitted, a.origin)).connection).toBe(warm.connection);
  expect(records.at(-1)?.connection).toBe('reused');
  await read(subject, admitted, b.origin); expect(records.at(-1)?.connection).toBe('new');
  expect(globalThis.fetch).toBe(fetchBefore);
  for (const [key, value] of dispatchers) expect(globals[key]).toBe(value);
});

it('keeps two documents and four out-of-order native responses associated with their creating request', async () => {
  const a = await fixture(), subject = observer();
  const one: TransportObservation[] = [], two: TransportObservation[] = [];
  const first = scope(one), second = scope(two), baseline = names.map(name => dc.channel(name).hasSubscribers);
  const pending = [read(subject, first, a.origin + '/gate/a1'), read(subject, first, a.origin + '/gate/a2'), read(subject, second, a.origin + '/gate/b1'), read(subject, second, a.origin + '/gate/b2')];
  await a.seen;
  for (const [index, route, output, ordinal] of [[2, '/gate/b1', two, 1], [1, '/gate/a2', one, 2], [3, '/gate/b2', two, 2], [0, '/gate/a1', one, 1]] as const) {
    a.gates.get(route)!(); await pending[index]; expect(output.at(-1)?.ordinal).toBe(ordinal);
  }
  await Promise.all(pending); expect(one).toHaveLength(2); expect(two).toHaveLength(2);
  names.forEach((name, index) => expect(dc.channel(name).hasSubscribers).toBe(baseline[index]));
});

it('separates header wait and body completion, and never consumes an unfinished body', async () => {
  const a = await fixture(), subject = observer(), records: TransportObservation[] = [], admitted = scope(records);
  await read(subject, admitted, a.origin + '/pending');
  expect(records.at(-1)).toMatchObject({ outcome: 'response', connectMs: null });
  expect(records.at(-1)!.headersWaitMs).toBeGreaterThanOrEqual(50);
  await read(subject, admitted, a.origin + '/body'); expect(records.at(-1)!.bodyMs).toBeGreaterThanOrEqual(30);
  let raw!: Response;
  const returned = await subject.observe(admitted, 'marketing.designer', async () => raw = await fetch(a.origin + '/body'));
  expect(returned).toBe(raw); expect(returned.bodyUsed).toBe(false);
  expect(records.at(-1)).toMatchObject({ outcome: 'incomplete', bodyMs: null });
  const count = records.length; expect(await returned.json()).toEqual({ fictional: 'never-log-body' }); expect(records).toHaveLength(count);
});

it('preserves exact native rejection objects when abort and refusal events arrive before operation settlement', async () => {
  const a = await fixture(), subject = observer(), records: TransportObservation[] = [], admitted = scope(records);
  const controller = new AbortController(), nativeFailure = nativeFailureForNextRequest(); let raw: unknown;
  try {
    const pending = subject.observe(admitted, 'rsc.identity', async () => {
      try { return await fetch(a.origin + '/abort', { signal: controller.signal }); }
      // Native abort notification can follow fetch rejection. Keep this test's
      // operation open to prove error coverage; the next test proves late closure.
      catch (error) { raw = error; await nativeFailure.wait(); throw error; }
    });
    const rejected = expect(pending).rejects.toSatisfy(error => error === raw);
    await a.abortRequest; controller.abort(new Error('never-log-abort')); await rejected;
  } finally { nativeFailure.dispose(); }
  expect(records.at(-1)?.outcome).toBe('error');
  const closed = await fixture(), origin = closed.origin;
  await new Promise<void>(resolve => closed.server.close(() => resolve())); servers.splice(servers.indexOf(closed.server), 1);
  await expect(subject.observe(admitted, 'marketing.designer', async () => {
    try { return await fetch(origin); } catch (error) { raw = error; throw error; }
  })).rejects.toSatisfy(error => error === raw); await tick();
  expect(records.at(-1)).toMatchObject({ outcome: 'error', connection: 'unknown', connectMs: null });
  expect(JSON.stringify(records)).not.toMatch(/never-log|127\.0\.0\.1|cookie|Authorization/);
});

it('keeps a rejected operation incomplete when its native error arrives after closure, without a duplicate emission', async () => {
  const handlers = new Map<string, (message: unknown) => void>();
  const subject = observer({ subscribe: (name, fn) => { handlers.set(name, fn); }, unsubscribe: name => handlers.delete(name) });
  const records: TransportObservation[] = [], request = {}, failure = Error('never-log-late-error');
  let nativeError!: (message: unknown) => void;
  await expect(subject.observe(scope(records), 'rsc.identity', () => {
    handlers.get('undici:request:create')!({ request });
    nativeError = handlers.get('undici:request:error')!;
    return Promise.reject(failure);
  })).rejects.toBe(failure);
  expect(records).toEqual([{ operation: 'rsc.identity', ordinal: 1, connection: 'unknown', dispatchMs: null, headersWaitMs: null, bodyMs: null, connectMs: null, outcome: 'incomplete' }]);
  expect(handlers.size).toBe(0);
  nativeError({ request, error: failure }); await tick();
  expect(records).toHaveLength(1); expect(records[0].outcome).toBe('incomplete');
  expect(JSON.stringify(records)).not.toContain('never-log');
});

it('caps native observation and retained document/active state while every ordinary read still executes', async () => {
  const a = await fixture(), records: TransportObservation[] = [];
  const subject = observer(undefined, { perOperation: 2, perDocument: 3, documents: 1, active: 1 }), admitted = scope(records);
  for (const operation of ['marketing.hub', 'marketing.hub', 'marketing.hub', 'marketing.commercial', 'marketing.designer'] as const) await read(subject, admitted, a.origin, operation);
  expect(a.reads()).toBe(5); expect(records).toHaveLength(3);
  const next: TransportObservation[] = []; await read(subject, scope(next), a.origin); expect(next).toHaveLength(0);
  let release!: () => void;
  const pending = subject.observe(admitted, 'rsc.identity', () => new Promise<void>(resolve => { release = resolve; }));
  const marker = {}; expect(await subject.observe(admitted, 'marketing.designer', () => marker)).toBe(marker); release(); await pending;
  expect(records).toHaveLength(3);
});

it('expires and unsubscribes during a native read without changing its eventual response', async () => {
  const a = await fixture(), subject = observer(), records: TransportObservation[] = [];
  const baseline = names.map(name => dc.channel(name).hasSubscribers);
  const pending = read(subject, scope(records, { until: Date.now() + 30 }), a.origin + '/pending');
  await delay(50); names.forEach((name, index) => expect(dc.channel(name).hasSubscribers).toBe(baseline[index]));
  expect((await pending).fictional).toBe('never-log-body'); expect(records).toHaveLength(0);
});

it('isolates malformed native payloads, synchronous log throws and rejected asynchronous emitters', async () => {
  const a = await fixture(), subject = observer();
  for (const emit of [() => { throw Error('logger'); }, () => Promise.reject(new Error('async logger'))]) {
    let raw!: Response;
    const returned = await subject.observe(scope([], { emit }), 'marketing.hub', async () => {
      dc.channel('undici:request:create').publish({ get request() { throw Error('malformed'); } });
      raw = await fetch(a.origin); await raw.text(); return raw;
    });
    expect(returned).toBe(raw); await tick();
  }
});

it('rolls back a partial subscribe failure and reports not_observed rather than invented zero network work', async () => {
  const baseline = names.map(name => dc.channel(name).hasSubscribers); let calls = 0;
  const subject = observer({ subscribe(name, listener) { if (++calls === 2) throw Error('setup'); dc.subscribe(name, listener); }, unsubscribe: dc.unsubscribe });
  const marker = {}; expect(await subject.observe(scope([]), 'rsc.identity', () => marker)).toBe(marker);
  names.forEach((name, index) => expect(dc.channel(name).hasSubscribers).toBe(baseline[index]));
  const records: TransportObservation[] = [], healthy = observer();
  expect(await healthy.observe(scope(records), 'marketing.hub', () => marker)).toBe(marker);
  expect(records).toEqual([{ operation: 'marketing.hub', ordinal: 1, connection: 'unknown', dispatchMs: null, headersWaitMs: null, bodyMs: null, connectMs: null, outcome: 'not_observed' }]);
});

it('cannot call a zero-use socket new across an unsubscribed coverage gap', async () => {
  const handlers = new Map<string, (message: unknown) => void>();
  const subject = observer({ subscribe: (name, fn) => { handlers.set(name, fn); }, unsubscribe: name => handlers.delete(name) });
  const records: TransportObservation[] = [], admitted = scope(records), socket = {}, request = {};
  await subject.observe(admitted, 'marketing.hub', () => handlers.get('undici:client:connected')!({ socket }));
  records.length = 0;
  await subject.observe(admitted, 'marketing.hub', () => {
    handlers.get('undici:request:create')!({ request }); handlers.get('undici:client:sendHeaders')!({ request, socket });
    handlers.get('undici:request:bodySent')!({ request }); handlers.get('undici:request:headers')!({ request, response: { statusCode: 200 } });
    handlers.get('undici:request:trailers')!({ request });
  });
  expect(records.at(-1)?.connection).toBe('unknown'); expect(handlers.size).toBe(0);
});
