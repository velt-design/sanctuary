const { AsyncLocalStorage } = require('node:async_hooks');
const dc = require('node:diagnostics_channel');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const routeNames = new Map([
  ['/dashboard', 'dashboard'], ['/staff/projects', 'projects'], ['/staff/contacts', 'contacts'],
  ['/staff/schedule', 'schedule'], ['/staff/projects/work-queue', 'work-queue'],
  ['/staff/projects/design-packages', 'drafting'], ['/staff/projects/running-jobs', 'running'],
]);
function operation(request) {
  let pathname;
  try { pathname = new URL(request.path, 'http://private.invalid').pathname; } catch { return 'other'; }
  if (pathname === '/auth/v1/user') return 'identity';
  if (pathname === '/auth/v1/token') return 'auth-refresh';
  if (pathname === '/rest/v1/portal_users') return 'role';
  if (pathname === '/rest/v1/portal_user_theme_settings') return 'theme-settings';
  if (pathname === '/rest/v1/portal_user_theme_presets') return 'theme-preset';
  if (/^\/rest\/v1\/(schedule_crews|crew_schedule_items|scheduled_jobs|crew_downtimes|public_holidays|company_closures)$/.test(pathname)) return 'schedule';
  return 'other';
}

function install({ prototype = http.Server.prototype, channels = dc, now = () => performance.now(), write, storage = new AsyncLocalStorage(), port, targetOrigin }) {
  let sequence = 0;
  let requestLimitSeen = false;
  const originalEmit = prototype.emit;
  const pending = new WeakMap();
  const subscriptions = [];
  const emit = (record) => { try { write({ ...record, atEpochMs: Date.now() }); } catch { /* Observation cannot change the request. */ } };
  const elapsed = (scope) => Number((now() - scope.start).toFixed(1));
  function subscribe(name, callback) {
    const listener = (event) => { try { callback(event); } catch { /* Never affect transport. */ } };
    channels.subscribe(name, listener);
    subscriptions.push([name, listener]);
  }
  prototype.emit = function (event, ...args) {
    if (event !== 'request') return Reflect.apply(originalEmit, this, [event, ...args]);
    const [request, response] = args;
    const loopbacks = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (request.socket?.localAddress !== '127.0.0.1' || !loopbacks.includes(request.socket?.remoteAddress) || request.socket?.localPort !== port) {
      return Reflect.apply(originalEmit, this, [event, ...args]);
    }
    let route;
    try { route = routeNames.get(new URL(request.url, 'http://private.invalid').pathname); } catch { /* Ignore malformed request. */ }
    if (!route || request.method !== 'GET') return Reflect.apply(originalEmit, this, [event, ...args]);
    if (sequence >= 128) {
      if (!requestLimitSeen) { requestLimitSeen = true; emit({ event: 'diagnostic-limit', kind: 'server-requests', limit: 128 }); }
      return Reflect.apply(originalEmit, this, [event, ...args]);
    }
    const scope = { id: ++sequence, start: now(), route, operations: {}, ordinal: 0 };
    emit({ event: 'request-start', id: scope.id, route, kind: request.headers.rsc === '1' ? 'flight' : 'other', atEpochMs: Date.now() });
    let firstBody = false;
    let firstHeaders = false;
    for (const name of ['writeHead', 'flushHeaders', 'write', 'end']) {
      const original = response[name];
      if (typeof original !== 'function') continue;
      response[name] = function (...values) {
        if (!firstHeaders && ['writeHead', 'flushHeaders', 'write', 'end'].includes(name)) {
          firstHeaders = true;
          emit({ event: 'headers-queued', id: scope.id, ms: elapsed(scope) });
        }
        if (!firstBody && ['write', 'end'].includes(name) && values[0] != null) {
          firstBody = true;
          emit({ event: 'body-first-write', id: scope.id, ms: elapsed(scope) });
        }
        return Reflect.apply(original, this, values);
      };
    }
    response.once('finish', () => emit({ event: 'request-finish', id: scope.id, ms: elapsed(scope), status: response.statusCode, operations: scope.operations }));
    response.once('close', () => emit({ event: 'request-close', id: scope.id, ms: elapsed(scope), complete: response.writableFinished }));
    return storage.run(scope, () => Reflect.apply(originalEmit, this, [event, ...args]));
  };
  subscribe('undici:request:create', ({ request }) => {
    const scope = storage.getStore();
    if (!scope) return;
    const op = targetOrigin && String(request.origin) === targetOrigin ? operation(request) : 'other';
    scope.operations[op] = (scope.operations[op] || 0) + 1;
    const record = { scope, ordinal: ++scope.ordinal, operation: op, start: now() };
    pending.set(request, record);
    emit({ event: 'transport-start', id: scope.id, ordinal: record.ordinal, operation: op, ms: elapsed(scope) });
  });
  subscribe('undici:request:headers', ({ request, response }) => {
    const record = pending.get(request);
    if (!record) return;
    emit({ event: 'transport-headers', id: record.scope.id, ordinal: record.ordinal, operation: record.operation,
      ms: elapsed(record.scope), durationMs: Number((now() - record.start).toFixed(1)), status: response.statusCode });
  });
  for (const [channel, event] of [['undici:request:trailers', 'transport-complete'], ['undici:request:error', 'transport-error']]) {
    subscribe(channel, ({ request }) => {
      const record = pending.get(request);
      if (!record) return;
      pending.delete(request);
      emit({ event, id: record.scope.id, ordinal: record.ordinal, operation: record.operation,
        ms: elapsed(record.scope), durationMs: Number((now() - record.start).toFixed(1)) });
    });
  }
  return () => {
    prototype.emit = originalEmit;
    subscriptions.forEach(([name, listener]) => channels.unsubscribe(name, listener));
  };
}

const DIRECTORY = path.resolve(__dirname, '../../artifacts/portal-performance-diagnostics');
const MAX_FILE_BYTES = 512 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const MAX_LOG_ROWS = 4096;
const operations = new Set(['identity', 'role', 'auth-refresh', 'theme-settings', 'theme-preset', 'schedule', 'other']);
const categories = new Set([...routeNames.values(), 'project-detail', 'static', 'contacts-data', 'projects-data', 'dashboard-data', 'schedule-data', 'api', 'external', 'other']);
const kinds = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr', 'font', 'image', 'other']);
const journeyNames = new Set(['dashboard-to-projects', 'dashboard-to-contacts', 'projects-to-project', 'project-back-to-projects',
  'projects-to-dashboard', 'dashboard-to-schedule', 'dashboard-to-work-queue', 'dashboard-to-design-list', 'dashboard-to-running-jobs']);
const events = new Set(['observer-ready', 'request-start', 'headers-queued', 'body-first-write', 'request-finish', 'request-close',
  'transport-start', 'transport-headers', 'transport-complete', 'transport-error', 'diagnostic-limit']);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9e15 ? value : null;

/** Reconstruct the fixed public diagnostic schema; never echo arbitrary fields. */
function safeRecord(input) {
  if (!input || typeof input !== 'object') return null;
  if (input.event === 'network-journey') {
    return { event: 'network-journey', journey: journeyNames.has(input.journey) ? input.journey : 'other', atEpochMs: number(input.atEpochMs),
      clock: input.clock && typeof input.clock === 'object' ? {
        startedAtEpochMs: number(input.clock.startedAtEpochMs), firstVisibleAtEpochMs: number(input.clock.firstVisibleAtEpochMs),
      } : null,
      coverage: 'requests-starting-after-listener',
      requestLimit: number(input.requestLimit), omittedRequests: number(input.omittedRequests),
      requests: (Array.isArray(input.requests) ? input.requests : []).slice(0, 128).map(row => ({
        ordinal: number(row.ordinal), category: categories.has(row.category) ? row.category : 'other',
        resourceKind: kinds.has(row.resourceKind) ? row.resourceKind : 'other', observedAtEpochMs: number(row.observedAtEpochMs),
        startAtEpochMs: number(row.startAtEpochMs), headersMs: number(row.headersMs), endMs: number(row.endMs),
        status: number(row.status), failed: row.failed === true,
      })) };
  }
  if (!events.has(input.event)) return null;
  const result = { event: input.event };
  for (const key of ['atEpochMs', 'id', 'ordinal', 'ms', 'durationMs', 'status', 'port', 'limit']) {
    if (key in input) result[key] = number(input[key]);
  }
  if ('route' in input) result.route = categories.has(input.route) ? input.route : 'other';
  if ('operation' in input) result.operation = operations.has(input.operation) ? input.operation : 'other';
  if ('kind' in input) result.kind = ['flight', 'other', 'server-requests', 'server-file', 'network-file', 'log-output'].includes(input.kind) ? input.kind : 'other';
  if ('complete' in input) result.complete = input.complete === true;
  if (input.operations && typeof input.operations === 'object') {
    result.operations = Object.fromEntries(Object.entries(input.operations).filter(([key]) => operations.has(key)).map(([key, value]) => [key, number(value)]));
  }
  return result;
}

function emitDiagnostics(directory = DIRECTORY, output = line => console.log(line)) {
  output('PORTAL_PERFORMANCE_DIAGNOSTICS_BEGIN');
  let bytes = 0, rows = 0, limited = false;
  const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => /^(?:server-[0-9]+|network-run-[1-5])\.jsonl$/.test(name)).sort() : [];
  for (const filename of files.slice(0, 32)) {
    const file = path.join(directory, filename);
    if (fs.statSync(file).size > 2 * 1024 * 1024) { limited = true; continue; }
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      let record;
      try { record = safeRecord(JSON.parse(line)); } catch { continue; }
      if (!record) continue;
      const serialized = JSON.stringify(record);
      if (rows >= MAX_LOG_ROWS || bytes + Buffer.byteLength(serialized) > MAX_LOG_BYTES) { limited = true; break; }
      output(serialized); rows++; bytes += Buffer.byteLength(serialized);
    }
    if (limited) break;
  }
  if (limited || files.length > 32) output(JSON.stringify({ event: 'diagnostic-limit', kind: 'log-output', limit: MAX_LOG_BYTES }));
  output('PORTAL_PERFORMANCE_DIAGNOSTICS_END');
}

module.exports = { install, safeRecord, emitDiagnostics };
if (process.argv.includes('--emit')) {
  emitDiagnostics();
} else if (process.env.PORTAL_PERF_SERVER_OBSERVER === '1') {
  const port = Number(process.env.PORTAL_PLAYWRIGHT_PORT || 3011);
  if (process.env.CI !== 'true' || process.env.PORTAL_PLAYWRIGHT_PRODUCTION !== '1' || process.env.PORTAL_PERF_DIAGNOSTICS !== '1' ||
      !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Server diagnostics require the CI loopback performance target.');
  let targetOrigin;
  try { targetOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin; }
  catch { throw new Error('Server diagnostics require the configured test source.'); }
  fs.mkdirSync(DIRECTORY, { recursive: true });
  const output = fs.createWriteStream(path.join(DIRECTORY, `server-${process.pid}.jsonl`), { flags: 'a', encoding: 'utf8' });
  output.on('error', () => {});
  let bytes = 0, limited = false;
  const write = record => {
    if (limited) return;
    const line = JSON.stringify(safeRecord(record)) + '\n';
    if (bytes + Buffer.byteLength(line) > MAX_FILE_BYTES - 128) {
      limited = true;
      output.write(JSON.stringify({ event: 'diagnostic-limit', kind: 'server-file', limit: MAX_FILE_BYTES }) + '\n');
      return;
    }
    bytes += Buffer.byteLength(line); output.write(line);
  };
  write({ event: 'observer-ready', port, atEpochMs: Date.now() });
  install({ port, targetOrigin, write });
}
