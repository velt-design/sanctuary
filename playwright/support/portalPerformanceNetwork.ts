import fs from 'node:fs';
import path from 'node:path';
import type { Page, Request, Response } from '@playwright/test';

const routes: Record<string, string> = {
  '/dashboard': 'dashboard', '/staff/projects': 'projects', '/staff/contacts': 'contacts',
  '/staff/schedule': 'schedule', '/staff/projects/work-queue': 'work-queue',
  '/staff/projects/design-packages': 'drafting', '/staff/projects/running-jobs': 'running',
};
const resourceKinds = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr', 'font', 'image']);
const journeys = new Set([
  'dashboard-to-projects', 'dashboard-to-contacts', 'projects-to-project', 'project-back-to-projects',
  'projects-to-dashboard', 'dashboard-to-schedule', 'dashboard-to-work-queue', 'dashboard-to-design-list',
  'dashboard-to-running-jobs',
]);
const MAX_REQUESTS = 128;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const limitedFiles = new Set<string>();

function category(url: string, origin: string): string {
  const parsed = new URL(url);
  if (parsed.origin !== origin) return 'external';
  if (routes[parsed.pathname]) return routes[parsed.pathname];
  if (/^\/staff\/projects\/(?:proj_)?[0-9a-f-]{36}$/i.test(parsed.pathname)) return 'project-detail';
  if (parsed.pathname.startsWith('/_next/')) return 'static';
  if (parsed.pathname === '/api/staff/v1/contacts/index') return 'contacts-data';
  if (parsed.pathname === '/api/staff/v1/projects/index') return 'projects-data';
  if (parsed.pathname === '/api/dashboard') return 'dashboard-data';
  if (parsed.pathname.startsWith('/api/staff/v1/schedule/')) return 'schedule-data';
  if (parsed.pathname.startsWith('/api/')) return 'api';
  return 'other';
}

type NetworkRow = {
  ordinal: number;
  category: string;
  resourceKind: string;
  observedAtEpochMs: number;
  startAtEpochMs: number | null;
  headersMs: number | null;
  endMs: number | null;
  status: number | null;
  failed: boolean;
};

/** Native Playwright metadata only. No URL/header/body/error text enters a row. */
export function createPortalNetworkTrace(page: Page, origin: string, write: (record: object) => void) {
  const requests = new Map<Request, NetworkRow>();
  let clock: { startedAtEpochMs: number; firstVisibleAtEpochMs: number | null } | null = null;
  let omitted = 0;
  let stopped = false;
  const snapshot = (request: Request) => {
    const row = requests.get(request);
    if (!row) return;
    try {
      const timing = request.timing();
      row.startAtEpochMs = Number.isFinite(timing.startTime) && timing.startTime > 0 ? timing.startTime : null;
      row.headersMs = Number.isFinite(timing.responseStart) && timing.responseStart >= 0 ? timing.responseStart : null;
      row.endMs = Number.isFinite(timing.responseEnd) && timing.responseEnd >= 0 ? timing.responseEnd : null;
    } catch { /* Disposed/incomplete requests stay explicitly unknown. */ }
  };
  const onRequest = (request: Request) => {
    if (requests.size >= MAX_REQUESTS) { omitted++; return; }
    let requestCategory = 'other';
    try { requestCategory = category(request.url(), origin); } catch { /* Never serialize an unrecognized URL. */ }
    const kind = request.resourceType();
    requests.set(request, {
      ordinal: requests.size + 1, category: requestCategory,
      resourceKind: resourceKinds.has(kind) ? kind : 'other', observedAtEpochMs: Date.now(),
      startAtEpochMs: null, headersMs: null, endMs: null, status: null, failed: false,
    });
    snapshot(request);
  };
  const onResponse = (response: Response) => {
    const row = requests.get(response.request());
    if (row) row.status = response.status();
    snapshot(response.request());
  };
  const onFinished = (request: Request) => snapshot(request);
  const onFailed = (request: Request) => {
    const row = requests.get(request);
    if (row) row.failed = true;
    snapshot(request);
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfinished', onFinished);
  page.on('requestfailed', onFailed);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('requestfinished', onFinished);
    page.off('requestfailed', onFailed);
  };
  return {
    stop,
    async captureDestinationClock(id: string) {
      if (stopped) return;
      try {
        clock = await page.evaluate(id => {
          const capture = (window as Window & { __portalVisibleDestination?: {
            id: string; startedAt: number; completedAt: number | null;
          } }).__portalVisibleDestination;
          if (!capture || capture.id !== id || !Number.isFinite(capture.startedAt) || !Number.isFinite(performance.timeOrigin)) return null;
          return {
            startedAtEpochMs: performance.timeOrigin + capture.startedAt,
            firstVisibleAtEpochMs: capture.completedAt !== null && Number.isFinite(capture.completedAt)
              ? performance.timeOrigin + capture.completedAt : null,
          };
        }, id);
      } catch { clock = null; }
    },
    finish(name: string) {
      if (stopped) return;
      stop();
      requests.forEach((_row, request) => snapshot(request));
      write({ event: 'network-journey', journey: journeys.has(name) ? name : 'other', atEpochMs: Date.now(),
        clock, coverage: 'requests-starting-after-listener',
        requestLimit: MAX_REQUESTS, omittedRequests: omitted, requests: Array.from(requests.values()) });
    },
  };
}

export function beginPortalNetworkTrace(page: Page) {
  if (process.env.PORTAL_PERF_DIAGNOSTICS !== '1') return undefined;
  if (process.env.CI !== 'true' || process.env.PORTAL_PLAYWRIGHT_PRODUCTION !== '1') throw new Error('Performance diagnostics require the CI production timing target.');
  const port = Number(process.env.PORTAL_PLAYWRIGHT_PORT ?? 3011);
  const origin = process.env.PORTAL_BASE_URL || `http://127.0.0.1:${port}`;
  let target: URL;
  try { target = new URL(origin); } catch { throw new Error('Performance diagnostics require the loopback test target.'); }
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      target.protocol !== 'http:' || Number(target.port) !== port || target.username || target.password ||
      target.pathname !== '/' || target.search || target.hash) throw new Error('Performance diagnostics require the loopback test target.');
  const run = path.basename(process.env.PORTAL_PERF_ARTIFACT ?? '');
  if (!/^run-[1-5]\.json$/.test(run)) return undefined;
  const directory = path.resolve(__dirname, '../../artifacts/portal-performance-diagnostics');
  const file = path.join(directory, `network-${run.replace('.json', '.jsonl')}`);
  fs.mkdirSync(directory, { recursive: true });
  return createPortalNetworkTrace(page, target.origin, record => {
    if (limitedFiles.has(file)) return;
    const line = JSON.stringify(record) + '\n';
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size + Buffer.byteLength(line) > MAX_FILE_BYTES - 128) {
      limitedFiles.add(file);
      fs.appendFileSync(file, JSON.stringify({ event: 'diagnostic-limit', kind: 'network-file', limit: MAX_FILE_BYTES }) + '\n', 'utf8');
    } else fs.appendFileSync(file, line, 'utf8');
  });
}
