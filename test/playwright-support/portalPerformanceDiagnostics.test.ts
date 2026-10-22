// @vitest-environment node
import { EventEmitter } from 'node:events';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import type { Page, Request, Response } from '@playwright/test';
import { afterEach, expect, it, vi } from 'vitest';
import { beginPortalNetworkTrace, createPortalNetworkTrace } from '../../playwright/support/portalPerformanceNetwork';

const requireRepo = createRequire(path.resolve('package.json'));
const { install, safeRecord, emitDiagnostics } = requireRepo('./playwright/support/portalPerformanceServer.cjs');
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('requires the explicit CI production loopback target and never prints invalid target values', () => {
  const emitter = new EventEmitter();
  Object.assign(emitter, { evaluate: vi.fn() });
  const page = emitter as unknown as Page;
  vi.stubEnv('PORTAL_PERF_DIAGNOSTICS', '');
  expect(beginPortalNetworkTrace(page)).toBeUndefined();
  expect((emitter as EventEmitter & { evaluate: ReturnType<typeof vi.fn> }).evaluate).not.toHaveBeenCalled();
  vi.stubEnv('PORTAL_PERF_DIAGNOSTICS', '1'); vi.stubEnv('CI', 'true'); vi.stubEnv('PORTAL_PLAYWRIGHT_PRODUCTION', '1');
  vi.stubEnv('PORTAL_PLAYWRIGHT_PORT', '3011');
  for (const target of ['https://PRIVATE_VALUE.invalid', 'PRIVATE_VALUE', 'http://127.0.0.1:3011/?PRIVATE_VALUE']) {
    vi.stubEnv('PORTAL_BASE_URL', target);
    expect(() => beginPortalNetworkTrace(page)).toThrow('Performance diagnostics require the loopback test target.');
  }
  expect(emitter.eventNames()).toEqual([]);
});

it('wires the passive preload only into the explicitly selected production loopback test server', async () => {
  vi.stubEnv('PORTAL_PERF_DIAGNOSTICS', '1'); vi.stubEnv('CI', 'true');
  vi.stubEnv('PORTAL_PLAYWRIGHT_PRODUCTION', '1'); vi.stubEnv('PORTAL_BASE_URL', ''); vi.stubEnv('PORTAL_PLAYWRIGHT_PORT', '3011');
  vi.resetModules();
  const { default: config } = await import('../../playwright.config');
  const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  expect(server?.command).toBe('npm --prefix apps/portal run start -- -p 3011');
  expect(server?.env).toMatchObject({ PORTAL_PERF_SERVER_OBSERVER: '1', PORTAL_PERF_DIAGNOSTICS: '1', PORTAL_PLAYWRIGHT_PORT: '3011' });
  expect(server?.env?.NODE_OPTIONS).toContain('portalPerformanceServer.cjs');
});

it('projects only the matching existing capture without moving or retiring its timestamp', async () => {
  const capture = { id: 'current', startedAt: 5, completedAt: 35, stop: vi.fn() };
  vi.stubGlobal('window', { __portalVisibleDestination: capture });
  const page = Object.assign(new EventEmitter(), { evaluate: vi.fn(async (fn: (id: string) => unknown, id: string) => fn(id)) });
  const rows: any[] = [];
  const trace = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', row => rows.push(row));
  await trace.captureDestinationClock('current'); trace.finish('dashboard-to-contacts');
  expect(rows[0].clock).toEqual({ startedAtEpochMs: performance.timeOrigin + 5, firstVisibleAtEpochMs: performance.timeOrigin + 35 });
  expect(capture).toMatchObject({ id: 'current', startedAt: 5, completedAt: 35 }); expect(capture.stop).not.toHaveBeenCalled();
  const other = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', row => rows.push(row));
  await other.captureDestinationClock('retired'); other.finish('dashboard-to-projects');
  expect(rows[1].clock).toBeNull();
  const pending = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', row => rows.push(row));
  vi.stubGlobal('window', { __portalVisibleDestination: { id: 'pending', startedAt: 50, completedAt: null } });
  await pending.captureDestinationClock('pending'); pending.finish('dashboard-to-projects');
  expect(rows[2].clock).toEqual({ startedAtEpochMs: performance.timeOrigin + 50, firstVisibleAtEpochMs: null });
});

it('records native timing/status/failure categories without URL, query, headers, body or error text', () => {
  const page = new EventEmitter();
  const rows: object[] = [];
  const request = {
    url: () => 'http://127.0.0.1:3011/staff/contacts?q=PRIVATE_VALUE', resourceType: () => 'fetch',
    timing: () => ({ startTime: 1000, responseStart: 230, responseEnd: 340 }),
    headers: () => { throw new Error('Must not read private headers'); },
    failure: () => ({ errorText: 'PRIVATE_VALUE' }),
  } as unknown as Request;
  const response = { request: () => request, status: () => 200,
    body: () => { throw new Error('Must not read private body'); } } as unknown as Response;
  const trace = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', value => rows.push(value));
  const now = vi.spyOn(Date, 'now');
  now.mockReturnValue(1000); page.emit('request', request);
  now.mockReturnValue(1100); page.emit('response', response);
  now.mockReturnValue(1200); page.emit('requestfailed', request);
  now.mockRestore();
  trace.finish('dashboard-to-contacts');
  expect(rows).toEqual([expect.objectContaining({ event: 'network-journey', journey: 'dashboard-to-contacts', requests: [expect.objectContaining({
    ordinal: 1, category: 'contacts', resourceKind: 'fetch', startAtEpochMs: 1000, headersMs: 230, endMs: 340, status: 200, failed: true,
    observedAtEpochMs: 1000, responseObservedAtEpochMs: 1100, failedObservedAtEpochMs: 1200, finishedObservedAtEpochMs: null,
  })] })]);
  expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_VALUE|http:|"headers"|"body"|errorText|q=/);
  expect(page.eventNames()).toEqual([]);
  trace.finish('dashboard-to-contacts'); expect(rows).toHaveLength(1);
  page.emit('requestfinished', request);
  expect(rows[0]).toMatchObject({ requests: [expect.objectContaining({ finishedObservedAtEpochMs: null })] });
});

it('bounds requests, handles incomplete/disposed metadata, redacts unknown names and retires repeated captures', () => {
  const page = new EventEmitter(); const rows: any[] = [];
  const trace = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', value => rows.push(value));
  for (let i = 0; i < 140; i++) page.emit('request', {
    url: () => 'https://PRIVATE_VALUE.invalid/private', resourceType: () => 'PRIVATE_VALUE', timing: () => { throw new Error('PRIVATE_VALUE'); },
  });
  trace.finish('PRIVATE_VALUE'); trace.stop();
  expect(rows[0]).toMatchObject({ journey: 'other', omittedRequests: 12, requestLimit: 128 });
  expect(rows[0].requests).toHaveLength(128);
  expect(rows[0].requests[0]).toMatchObject({ category: 'external', resourceKind: 'other', headersMs: null, endMs: null });
  expect(JSON.stringify(rows)).not.toContain('PRIVATE_VALUE');
  const next = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', value => rows.push(value));
  next.stop(); expect(page.eventNames()).toEqual([]);
});

it('observes real Node callback/stream/backpressure/error contracts without wrapping fetch or Response', async () => {
  class Server extends EventEmitter {}
  class ServerResponse extends EventEmitter {
    statusCode = 200; writableFinished = false; chunks: unknown[] = [];
    writeHead() { return this; }
    flushHeaders() {}
    write(chunk: unknown) { this.chunks.push(chunk); return false; }
    end(chunk: unknown, callback: () => void) { this.chunks.push(chunk); callback(); this.writableFinished = true; this.emit('finish'); return this; }
  }
  const records: any[] = []; const channels = new Map(); let clock = 0;
  const originalFetch = globalThis.fetch, originalEmit = Server.prototype.emit;
  const unsubscribe = install({ prototype: Server.prototype, now: () => clock, port: 3011, targetOrigin: 'https://fixture.invalid', write: (row: object) => records.push(row), channels: {
    subscribe: (name: string, callback: unknown) => channels.set(name, callback),
    unsubscribe: (name: string) => channels.delete(name),
  } });
  try {
    const server = new Server(), response = new ServerResponse(), callback = vi.fn();
    const request = { method: 'GET', url: '/staff/contacts?q=PRIVATE_VALUE', headers: { rsc: '1', cookie: 'PRIVATE_VALUE' },
      socket: { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1', localPort: 3011 } };
    let finished: Promise<void> | undefined;
    server.on('request', () => {
      finished = Promise.resolve().then(() => {
        const outgoing = { origin: 'https://fixture.invalid', path: '/auth/v1/user?PRIVATE_VALUE' };
        channels.get('undici:request:create')({ request: outgoing });
        clock = 50; channels.get('undici:request:headers')({ request: outgoing, response: { statusCode: 200 } });
        clock = 60; channels.get('undici:request:trailers')({ request: outgoing });
        const denied = { origin: 'https://fixture.invalid', path: '/rest/v1/portal_users?PRIVATE_VALUE' };
        channels.get('undici:request:create')({ request: denied });
        channels.get('undici:request:error')({ request: denied, error: new Error('PRIVATE_VALUE') });
        expect(response.writeHead()).toBe(response); response.flushHeaders();
        const body = Buffer.from('PRIVATE_VALUE');
        expect(response.write(body)).toBe(false);
        expect(response.end(body, callback)).toBe(response);
        expect(response.chunks).toEqual([body, body]); response.emit('close');
      });
    });
    expect(server.emit('request', request, response)).toBe(true); await finished;
    expect(callback).toHaveBeenCalledOnce();
    expect(records.filter(row => row.event === 'headers-queued')).toHaveLength(1);
    expect(records.filter(row => row.event === 'body-first-write')).toHaveLength(1);
    expect(records.find(row => row.event === 'request-finish').operations).toEqual({ identity: 1, role: 1 });
    expect(records.find(row => row.event === 'transport-complete').durationMs).toBe(60);
    expect(records.filter(row => row.event === 'transport-error')).toHaveLength(1);
    expect(JSON.stringify(records)).not.toMatch(/PRIVATE_VALUE|fixture.invalid|cookie|headers":/);
    expect(globalThis.fetch).toBe(originalFetch);
    const throwing = new Server(), error = new Error('unchanged');
    throwing.on('request', () => { throw error; });
    expect(() => throwing.emit('request', request, new ServerResponse())).toThrow(error);
    const count = records.length; const ignored = new Server(); ignored.on('request', () => {});
    ignored.emit('request', { ...request, socket: { ...request.socket, localPort: 3214 } }, new ServerResponse());
    ignored.emit('request', { ...request, socket: { ...request.socket, localAddress: '0.0.0.0' } }, new ServerResponse());
    expect(records).toHaveLength(count);
    for (const address of ['::ffff:127.0.0.1', '::1']) {
      const loopback = new Server(); loopback.on('request', () => {});
      loopback.emit('request', { ...request, socket: { localAddress: address, remoteAddress: address, localPort: 3011 } }, new ServerResponse());
      expect(records.at(-1)).toMatchObject({ event: 'request-start', route: 'contacts' });
    }
    const acceptedCount = records.length;
    for (const socket of [
      { localAddress: '::', remoteAddress: '::1', localPort: 3011 },
      { localAddress: '::1', remoteAddress: '2001:db8::1', localPort: 3011 },
      { localAddress: '::ffff:192.0.2.1', remoteAddress: '::ffff:127.0.0.1', localPort: 3011 },
      { localAddress: '::ffff:127.0.0.1', remoteAddress: '::ffff:127.0.0.1', localPort: 3214 },
    ]) {
      const ignoredSocket = new Server(); ignoredSocket.on('request', () => {});
      ignoredSocket.emit('request', { ...request, socket }, new ServerResponse());
    }
    expect(records).toHaveLength(acceptedCount);
  } finally { unsubscribe(); }
  expect(Server.prototype.emit).toBe(originalEmit); expect(channels.size).toBe(0);
});

it('observes the actual default native listener through an IPv4 loopback client without changing the listener', async () => {
  const records: any[] = [];
  const originalEmit = http.Server.prototype.emit;
  const server = http.createServer((_request, response) => { response.end('fictional'); });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Native test listener unavailable');
  const unsubscribe = install({ port: address.port, write: (row: object) => records.push(row), channels: {
    subscribe() {}, unsubscribe() {},
  } });
  try {
    await new Promise<void>((resolve, reject) => {
      const request = http.get({ hostname: '127.0.0.1', port: address.port, path: '/staff/contacts' }, response => {
        expect(response.statusCode).toBe(200);
        response.resume(); response.once('end', resolve);
      });
      request.once('error', reject);
    });
    expect(records.filter(row => row.event === 'request-start')).toEqual([
      expect.objectContaining({ route: 'contacts', kind: 'other' }),
    ]);
    expect(records.filter(row => row.event === 'request-finish')).toEqual([
      expect.objectContaining({ status: 200, operations: {} }),
    ]);
    expect(records.filter(row => row.event === 'body-first-write')).toHaveLength(1);
  } finally {
    unsubscribe();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  expect(http.Server.prototype.emit).toBe(originalEmit);
});

it('emits only fixed allowlisted JSON fields inside bounded log markers, never raw file content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-perf-trace-'));
  try {
    fs.writeFileSync(path.join(directory, 'network-run-1.jsonl'), JSON.stringify({ event: 'network-journey', journey: 'PRIVATE_VALUE',
      url: 'PRIVATE_VALUE', headers: 'PRIVATE_VALUE', body: 'PRIVATE_VALUE', requests: [{ category: 'PRIVATE_VALUE', resourceKind: 'PRIVATE_VALUE', ordinal: 1, private: 'PRIVATE_VALUE' }] }) + '\n');
    fs.writeFileSync(path.join(directory, 'server-1.jsonl'), JSON.stringify({ event: 'request-finish', id: 1, operations: { identity: 1, PRIVATE_VALUE: 'PRIVATE_VALUE' }, private: 'PRIVATE_VALUE' }) + '\n');
    fs.writeFileSync(path.join(directory, 'untrusted.jsonl'), 'PRIVATE_VALUE');
    const lines: string[] = []; emitDiagnostics(directory, (line: string) => lines.push(line));
    expect(lines[0]).toBe('PORTAL_PERFORMANCE_DIAGNOSTICS_BEGIN');
    expect(lines.at(-1)).toBe('PORTAL_PERFORMANCE_DIAGNOSTICS_END');
    expect(lines.join('\n')).not.toMatch(/PRIVATE_VALUE|"url"|"headers"|"body"|"private"/);
    expect(JSON.parse(lines[2]).operations).toEqual({ identity: 1 });
    expect(safeRecord({ event: 'PRIVATE_VALUE', data: 'PRIVATE_VALUE' })).toBeNull();
    expect(safeRecord({ event: 'network-journey', requests: [{ responseObservedAtEpochMs: 1000,
      finishedObservedAtEpochMs: Infinity, failedObservedAtEpochMs: 'PRIVATE_VALUE' }] }).requests[0]).toMatchObject({
      responseObservedAtEpochMs: 1000, finishedObservedAtEpochMs: null, failedObservedAtEpochMs: null,
    });
  } finally {
    expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('bounds diagnostic file emission and rejects observer activation outside the CI test target', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-perf-trace-'));
  try {
    fs.writeFileSync(path.join(directory, 'server-1.jsonl'), Buffer.alloc(2 * 1024 * 1024 + 1, 65));
    const lines: string[] = []; emitDiagnostics(directory, (line: string) => lines.push(line));
    expect(lines).toEqual(['PORTAL_PERFORMANCE_DIAGNOSTICS_BEGIN',
      JSON.stringify({ event: 'diagnostic-limit', kind: 'log-output', limit: 2 * 1024 * 1024 }), 'PORTAL_PERFORMANCE_DIAGNOSTICS_END']);
    const child = spawnSync(process.execPath, ['--require', path.resolve('playwright/support/portalPerformanceServer.cjs'), '-e', ''], {
      env: { CI: 'false', PORTAL_PLAYWRIGHT_PRODUCTION: '1', PORTAL_PERF_DIAGNOSTICS: '1', PORTAL_PERF_SERVER_OBSERVER: '1' }, encoding: 'utf8',
    });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain('Server diagnostics require the CI loopback performance target.');
  } finally {
    expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
