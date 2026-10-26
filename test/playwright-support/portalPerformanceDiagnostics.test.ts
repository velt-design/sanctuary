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
import NativeReporter, { NATIVE_BEGIN, NATIVE_END, NATIVE_LIMITS, collectNativeCapture, nativeStaticChunk, nativeTarget, projectNativeCapture, safeNativeRow } from '../../playwright/support/portalPerformanceCausal';

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
    timing: () => ({ startTime: 1000, requestStart: 15, responseStart: 230, responseEnd: 340 }),
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
    ordinal: 1, category: 'contacts', resourceKind: 'fetch', startAtEpochMs: 1000, requestStartMs: 15, headersMs: 230, endMs: 340, status: 200, failed: true,
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
  expect(rows[0].requests[0]).toMatchObject({ category: 'external', resourceKind: 'other', requestStartMs: null, headersMs: null, endMs: null });
  expect(JSON.stringify(rows)).not.toContain('PRIVATE_VALUE');
  const next = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', value => rows.push(value));
  next.stop(); expect(page.eventNames()).toEqual([]);
});

it.each([undefined, -1, NaN, Infinity])('keeps an unavailable native request-start offset unknown: %s', requestStart => {
  const page = new EventEmitter(); const rows: any[] = [];
  const trace = createPortalNetworkTrace(page as unknown as Page, 'http://127.0.0.1:3011', row => rows.push(row));
  page.emit('request', { url: () => 'http://127.0.0.1:3011/staff/contacts', resourceType: () => 'fetch',
    timing: () => ({ startTime: 1000, requestStart, responseStart: -1, responseEnd: -1 }) });
  trace.finish('dashboard-to-contacts');
  expect(rows[0].requests[0]).toMatchObject({ startAtEpochMs: 1000, requestStartMs: null, headersMs: null, endMs: null });
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
      finishedObservedAtEpochMs: Infinity, failedObservedAtEpochMs: 'PRIVATE_VALUE', requestStartMs: 'PRIVATE_VALUE' }] }).requests[0]).toMatchObject({
      responseObservedAtEpochMs: 1000, finishedObservedAtEpochMs: null, failedObservedAtEpochMs: null, requestStartMs: null,
    });
    expect(safeRecord({ event: 'network-journey', requests: [{ requestStartMs: 0 }, { requestStartMs: 15 },
      { requestStartMs: Infinity }, {}] }).requests.map((row: { requestStartMs: number | null }) => row.requestStartMs)).toEqual([0, 15, null, null]);
  } finally {
    expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('projects only native spans and actual public chunk positions without private fields', () => {
  const origin = 'http://127.0.0.1:3011', emitted = new Set(['abc123_X.js']);
  const events = [
    { name: 'Layout', ph: 'X', ts: 1000, dur: 52000, args: { data: { url: origin + '/_next/static/chunks/abc123_X.js', text: 'PRIVATE_VALUE' } } },
    { name: 'PRIVATE_VALUE', ph: 'X', ts: 4000, dur: 8000 },
    { name: 'FunctionCall', ph: 'X', ts: 60000, dur: 8000, args: { data: { url: origin + '/_next/static/chunks/abc123_X.js?PRIVATE_VALUE' } } },
  ];
  const profile = { nodes: [{ id: 1, callFrame: { url: origin + '/_next/static/chunks/abc123_X.js', functionName: 'PRIVATE_VALUE', lineNumber: 12, columnNumber: 34 } }, { id: 2, callFrame: { url: 'https://private.invalid/PRIVATE_VALUE' } }], samples: [1, 2], timeDeltas: [1000, 2000] };
  const rows = projectNativeCapture('dashboard-cold', events, profile, origin, emitted, 'complete');
  expect(rows[0]).toMatchObject({ event: 'Layout', startMs: 0, durationMs: 52, chunk: 'abc123_X.js' });
  expect(rows).toContainEqual(expect.objectContaining({ kind: 'cpu', chunk: 'abc123_X.js', line: 12, column: 34, samples: 1, selfMs: 1 }));
  expect(rows.at(-1)).toMatchObject({ status: 'complete', traceEvents: 3, cpuSamples: 2 });
  expect(rows.every(row => safeNativeRow(row))).toBe(true);
  expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_VALUE|http|functionName|url|args/);
  for (const value of [origin + '/_next/static/chunks/unlisted.js', origin + '/_next/static/chunks/abc123_X.js#private', origin + '/private/abc123_X.js', 'https://elsewhere.invalid/_next/static/chunks/abc123_X.js']) expect(nativeStaticChunk(value, origin, emitted)).toBeUndefined();
});

it('rejects poisoned native rows and labels capped or unavailable coverage honestly', () => {
  const valid = { schema: 1, kind: 'span', journey: 'contacts-warm', source: 'trace', event: 'Layout', startMs: 0, durationMs: 51 };
  for (const poison of [{ ...valid, url: 'PRIVATE_VALUE' }, { ...valid, event: 'PRIVATE_VALUE' }, { ...valid, startMs: NaN }, { ...valid, durationMs: Infinity }, { ...valid, chunk: '../../PRIVATE_VALUE.js' }, { ...valid, line: 2 }, { ...valid, column: -1 }, { get schema() { throw Error('PRIVATE_VALUE'); } }]) expect(safeNativeRow(poison)).toBeNull();
  const events = Array.from({ length: NATIVE_LIMITS.traceSpans + 2 }, (_, i) => ({ name: 'Layout', ph: 'X', ts: i * 2000, dur: 1000 }));
  const rows = projectNativeCapture('contacts-warm', events, { nodes: [], samples: [1], timeDeltas: [NaN] }, 'http://127.0.0.1:3011', new Set(), 'complete');
  expect(rows).toHaveLength(NATIVE_LIMITS.traceSpans + 1);
  expect(rows.at(-1)).toMatchObject({ status: 'unavailable', projectionCapped:true, dropped: 3 });
  expect(projectNativeCapture('running-warm', [null, {}, 'PRIVATE_VALUE'], null, 'http://127.0.0.1:3011', new Set(), 'unavailable')).toEqual([{ schema: 1, kind: 'coverage', journey: 'running-warm', status: 'unavailable', projectionCapped:false, traceEvents: 3, cpuSamples: 0, dropped: 0 }]);
});

it('suppresses reporter errors, attachments and poisoned stdout, with bounded output', () => {
  const output: string[] = [], reporter = new NativeReporter(text => output.push(text));
  reporter.onBegin(); reporter.onStdOut('PRIVATE_VALUE DOM snapshot https://private.invalid\n');
  reporter.onStdOut(JSON.stringify({ schema: 1, kind: 'run', status: 'passed', error: 'PRIVATE_VALUE' }) + '\n');
  reporter.onStdOut('{"schema":1,"kind":"run",'); reporter.onStdOut('"status":"failed"}\n');
  reporter.onStdErr(); reporter.onError();
  reporter.onTestEnd({} as any, { status: 'failed', error: { message: 'PRIVATE_VALUE' }, attachments: [{ body: Buffer.from('PRIVATE_VALUE') }] } as any);
  reporter.onEnd({ status: 'failed' } as any);
  expect(output[0]).toBe(NATIVE_BEGIN + '\n'); expect(output.join('')).toContain(NATIVE_END);
  expect(output.join('')).not.toMatch(/PRIVATE_VALUE|http|DOM|attachments|stack/);
  const capped: string[] = [], cap = new NativeReporter(text => capped.push(text));
  for (let i = 0; i < 2200; i++) cap.onStdOut('{"schema":1,"kind":"run","status":"passed"}\n');
  cap.onEnd({ status: 'passed' } as any);
  expect(capped.join('')).toContain('"status":"capped"'); expect(Buffer.byteLength(capped.join(''))).toBeLessThan(525000);
});

it('sanitizes actual pre-reporter framework output in memory without echoing failures', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'playwright/support/portalPerformanceCausal.ts', '--sanitize'], { encoding: 'utf8', input: 'PRIVATE_VALUE https://private.invalid\n' + JSON.stringify({ schema: 1, kind: 'run', status: 'failed', message: 'PRIVATE_VALUE' }) + '\n', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  expect(result.status).toBe(0); expect(result.stdout).toContain(NATIVE_BEGIN); expect(result.stdout).toContain('"status":"failed"'); expect(result.stdout).toContain(NATIVE_END);
  expect(result.stdout).not.toMatch(/PRIVATE_VALUE|http|message|Error|stack/);
});

it('isolates native privacy settings while preserving original default settings and five captures', async () => {
  vi.stubEnv('PLAYWRIGHT_NO_COPY_PROMPT','');
  vi.stubEnv('PORTAL_PERF_DIAGNOSTICS', '0'); vi.stubEnv('PORTAL_PERF_NATIVE_CAUSAL', ''); vi.stubEnv('CI', 'true'); vi.stubEnv('PORTAL_PLAYWRIGHT_PRODUCTION', '1'); vi.stubEnv('PORTAL_BASE_URL', ''); vi.stubEnv('PORTAL_PLAYWRIGHT_PORT', '3011'); vi.resetModules();
  const ordinary = (await import('../../playwright.config')).default;
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe('');
  expect(ordinary.retries).toBe(1); expect(ordinary.reporter).toEqual([['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]);
  expect(ordinary.use).toMatchObject({ trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' });
  vi.stubEnv('PORTAL_PERF_NATIVE_CAUSAL', '1'); vi.resetModules(); const native = (await import('../../playwright.config')).default;
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe('1');
  expect(native.retries).toBe(0); expect(native.use).toMatchObject({ trace: 'off', screenshot: 'off', video: 'off' });
  expect(native.reporter).toEqual([['./playwright/support/portalPerformanceCausal.ts']]);
  const server = Array.isArray(native.webServer) ? native.webServer[0] : native.webServer;
  expect(server).toMatchObject({ command: 'npm --prefix apps/portal run start -- -p 3011', stdout: 'ignore', stderr: 'ignore' });
  expect(server?.env).toMatchObject({ PORTAL_PERF_DIAGNOSTICS: '0', PORTAL_PERF_SERVER_OBSERVER: '0' }); expect(server?.env?.NODE_OPTIONS).toBeUndefined();
  const workflow = fs.readFileSync('.github/workflows/portal-quality.yml', 'utf8'), step = workflow.slice(workflow.indexOf('      - name: Supplemental bounded native causal diagnostic'));
  expect(step).toContain("steps.portal_performance.outcome == 'success'"); expect(step).toContain("PORTAL_PERF_DIAGNOSTICS: '0'");
  expect(step).toContain('--no-deps --workers=1 --retries=0 2>/dev/null | node --experimental-strip-types'); expect(step).toContain('set -o pipefail'); expect(step).not.toContain('upload-artifact');
  expect(workflow.indexOf('Upload portal timing artifact')).toBeLessThan(workflow.indexOf('Supplemental bounded native'));
  expect(workflow).toContain('for run in 1 2 3 4 5; do');
  expect(step).toContain("PLAYWRIGHT_NO_COPY_PROMPT: '1'");
  const installed=fs.readFileSync(path.join(path.dirname(requireRepo.resolve('playwright/package.json')),'lib/index.js'),'utf8');
  expect(installed).toContain('if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)');
  expect(installed.indexOf('if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)')).toBeLessThan(installed.indexOf('this._pageSnapshot = (await page._snapshotForAI'));
});

it('rejects unsafe native targets and concurrent original diagnostics without private values', () => {
  const env = { CI: 'true', PORTAL_PLAYWRIGHT_PRODUCTION: '1', PORTAL_PLAYWRIGHT_PORT: '3011', PORTAL_PERF_NATIVE_CAUSAL: '1', PORTAL_PERF_DIAGNOSTICS: '0' };
  expect(nativeTarget(env)).toBe('http://127.0.0.1:3011');
  for (const change of [{ PORTAL_BASE_URL: 'https://PRIVATE_VALUE.invalid' }, { PORTAL_PERF_DIAGNOSTICS: '1' }, { PORTAL_PLAYWRIGHT_PRODUCTION: '0' }, { CI: 'false' }, { PORTAL_PLAYWRIGHT_PORT: '1' }, { PORTAL_BASE_URL: 'http://127.0.0.1:3011/?PRIVATE_VALUE' }]) expect(() => nativeTarget({ ...env, ...change })).toThrow('Native diagnostic requires its dedicated CI loopback target.');
});

it('keeps late long spans and CPU locations across the full action, with independent quotas', () => {
  const origin='http://127.0.0.1:3011', emitted=new Set(['abc123_X.js','xyz789_A.js']);
  const events=Array.from({length:300},(_,i)=>({name:'Layout',ph:'X',ts:i*2000,dur:1000}));
  events.push({name:'RunTask',ph:'X',ts:900000,dur:81000});
  const profile={nodes:[{id:1,callFrame:{url:origin+'/_next/static/chunks/abc123_X.js',lineNumber:1,columnNumber:2}},{id:2,callFrame:{url:origin+'/_next/static/chunks/xyz789_A.js',lineNumber:3,columnNumber:4}}],samples:[...Array(200).fill(1),...Array(100).fill(2),1],timeDeltas:Array(301).fill(1000)};
  const rows=projectNativeCapture('schedule-toggle',events,profile,origin,emitted,'complete');
  expect(rows[0]).toMatchObject({event:'RunTask',startMs:900,durationMs:81});
  expect(rows).toContainEqual(expect.objectContaining({kind:'cpu',chunk:'xyz789_A.js',firstMs:200,lastMs:300,selfMs:100,samples:100}));
  expect(rows).toContainEqual(expect.objectContaining({kind:'cpu',chunk:'abc123_X.js',firstMs:0,lastMs:301,selfMs:201,samples:201}));
  expect(rows.at(-1)).toMatchObject({status:'complete',projectionCapped:true,traceEvents:301,cpuSamples:301});
  const printed:string[]=[],reporter=new NativeReporter(line=>printed.push(line),emitted);
  reporter.onStdOut(JSON.stringify({...rows[0],chunk:'PRIVATE_VALUE.js'})+'\n');
  reporter.onStdOut(JSON.stringify(rows.find(row=>row.kind==='cpu'&&row.chunk==='xyz789_A.js'))+'\n');
  expect(printed).toHaveLength(1);expect(printed.join('')).not.toContain('PRIVATE_VALUE');
  const metadata=projectNativeCapture('schedule-toggle',[{name:'thread_name',ph:'M',ts:0,args:{name:'PRIVATE_VALUE'}},...events],profile,origin,emitted,'complete');
  expect(metadata[0]).toMatchObject({event:'RunTask',startMs:900,durationMs:81});
  expect(projectNativeCapture('schedule-toggle',events,profile,origin,emitted,'failed').at(-1)).toMatchObject({status:'failed',projectionCapped:true});
  expect(projectNativeCapture('schedule-toggle',[],null,origin,emitted,'complete').at(-1)).toMatchObject({status:'unavailable'});
});

it.each(['complete','action-failed','raw-cap','missing','profiler-failed'] as const)('retires the real native collector protocol for %s without exposing raw errors', async mode => {
  const session=new EventEmitter() as EventEmitter & {send:ReturnType<typeof vi.fn>;detach:ReturnType<typeof vi.fn>};
  session.detach=vi.fn(async()=>undefined);
  session.send=vi.fn(async(method:string)=>{
    if(method==='Profiler.stop'&&mode==='profiler-failed')throw Error('PRIVATE_VALUE');
    if(method==='Tracing.end')session.emit('Tracing.tracingComplete',{});
    return method==='Profiler.stop'?{profile:{nodes:[{id:1,callFrame:{}}],samples:[1],timeDeltas:[1000]}}:{};
  });
  const page={context:()=>({newCDPSession:async()=>session}),waitForTimeout:vi.fn(async()=>undefined)} as unknown as Page;
  const output:object[]=[];
  const success=await collectNativeCapture(page,'schedule-toggle','http://127.0.0.1:3011',new Set(),async()=>{
    if(mode==='action-failed')throw new Error('PRIVATE_VALUE');
    if(mode==='missing')return;
    session.emit('Tracing.dataCollected',{value:mode==='raw-cap'?Array(NATIVE_LIMITS.events+1).fill({}):[{name:'Layout',ph:'X',ts:1000,dur:1200,args:{text:'PRIVATE_VALUE'}}]});
  },rows=>output.push(...rows));
  expect(success).toBe(mode==='complete');expect(output.at(-1)).toMatchObject({kind:'coverage',status:mode==='complete'?'complete':mode==='raw-cap'?'capped':mode==='missing'?'unavailable':'failed'});
  if(mode!=='action-failed')expect(page.waitForTimeout).toHaveBeenCalledWith(750);
  expect(session.detach).toHaveBeenCalledOnce();expect(session.eventNames()).toEqual([]);
  const prior=JSON.stringify(output);session.emit('Tracing.dataCollected',{value:[{text:'PRIVATE_VALUE'}]});expect(JSON.stringify(output)).toBe(prior);expect(prior).not.toContain('PRIVATE_VALUE');
});

it.each(['detail-warm','projects-back','dashboard-warm'] as const)('observes late adoption for %s without changing ordinary capture waits or bounds', async journey => {
  const session=new EventEmitter() as EventEmitter & {send:ReturnType<typeof vi.fn>;detach:ReturnType<typeof vi.fn>};
  session.detach=vi.fn(async()=>undefined);
  session.send=vi.fn(async(method:string)=>{
    if(method==='Tracing.end')session.emit('Tracing.tracingComplete',{});
    return method==='Profiler.stop'?{profile:{nodes:[{id:1,callFrame:{}}],samples:[1],timeDeltas:[3_000_000]}}:{};
  });
  const wait=vi.fn(async(milliseconds:number)=>{
    expect(milliseconds).toBe(3_000);
    session.emit('Tracing.dataCollected',{value:[{name:'RunTask',ph:'X',ts:2_001_000,dur:67_000}]});
  });
  const page={context:()=>({newCDPSession:async()=>session}),waitForTimeout:wait} as unknown as Page;
  const rows:object[]=[];
  expect(await collectNativeCapture(page,journey,'http://127.0.0.1:3011',new Set(),async()=>{
    session.emit('Tracing.dataCollected',{value:[{name:'Layout',ph:'X',ts:1_000,dur:1_200}]});
  },values=>rows.push(...values))).toBe(true);
  expect(wait).toHaveBeenCalledOnce();
  expect(rows).toContainEqual(expect.objectContaining({kind:'span',journey,event:'RunTask',startMs:2_000,durationMs:67}));
  expect(rows.at(-1)).toMatchObject({kind:'coverage',status:'complete'});
  expect(rows.every(row=>safeNativeRow(row))).toBe(true);
  expect(safeNativeRow({schema:1,kind:'coverage',journey:journey+'?PRIVATE_VALUE',status:'complete',projectionCapped:false,traceEvents:0,cpuSamples:0,dropped:0})).toBeNull();
  expect(NATIVE_LIMITS).toMatchObject({batchMs:160_000,gets:400,rawBytes:67_108_864,events:50_000});
  expect(session.detach).toHaveBeenCalledOnce();expect(session.eventNames()).toEqual([]);
});

it.each([false,true])('reserves profile bytes before the late trace tail, retaining action-failure precedence (%s)', async actionFails => {
  const initial={value:[{name:'Layout',ph:'X',ts:1000,dur:1200}]};
  const tail={value:[{name:'RunTask',ph:'X',ts:3000,dur:52000}]};
  const stopped={profile:{nodes:[{id:1,callFrame:{}}],samples:[1],timeDeltas:[1000],metadata:'PRIVATE_VALUE'.repeat(20)}};
  const size=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
  const mutable=NATIVE_LIMITS as {rawBytes:number},original=mutable.rawBytes;
  const session=new EventEmitter() as EventEmitter & {send:ReturnType<typeof vi.fn>;detach:ReturnType<typeof vi.fn>};session.detach=vi.fn(async()=>undefined);
  session.send=vi.fn(async(method:string)=>{
    if(method==='Tracing.end'){session.emit('Tracing.dataCollected',tail);session.emit('Tracing.tracingComplete',{});}
    return method==='Profiler.stop'?stopped:{};
  });
  const page={context:()=>({newCDPSession:async()=>session}),waitForTimeout:vi.fn(async()=>undefined)} as unknown as Page;
  const rows:object[]=[];
  try {
    mutable.rawBytes=size(initial)+size(stopped)+size(tail)-1;
    expect(size(initial)+size(tail)).toBeLessThan(mutable.rawBytes);
    const complete=await collectNativeCapture(page,'schedule-toggle','http://127.0.0.1:3011',new Set(),async()=>{session.emit('Tracing.dataCollected',initial);if(actionFails)throw Error('PRIVATE_VALUE');},values=>rows.push(...values));
    expect(complete).toBe(false);expect(rows.at(-1)).toMatchObject({kind:'coverage',status:actionFails?'failed':'capped'});
    expect(session.detach).toHaveBeenCalledOnce();expect(session.eventNames()).toEqual([]);expect(JSON.stringify(rows)).not.toContain('PRIVATE_VALUE');
  } finally {mutable.rawBytes=original;}
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
