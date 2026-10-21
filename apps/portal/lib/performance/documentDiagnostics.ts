import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PortalAccessTimingObserver } from '@/lib/portalAccess';

export const DOCUMENT_CARRIER_HEADER = 'x-portal-document-carrier';
export const DOCUMENT_ID_HEADER = 'x-portal-document-id';
const WINDOW_MS = 30 * 60 * 1_000;
const routes = ['/staff/projects', '/staff/projects/[projectId]', '/staff/site-visits'] as const;
type DocumentRoute = (typeof routes)[number];
const phases = ['proxy.identity', 'proxy.role', 'proxy.complete', 'rsc.identity', 'rsc.role', 'rsc.access', 'theme.settings', 'theme.preset', 'theme.fallback', 'theme.total', 'layout.complete'] as const;
type Phase = (typeof phases)[number];
export type DocumentOutcome = 'complete' | 'error' | 'empty' | 'skipped' | 'missing_relation' | 'authenticated' | 'unauthenticated' | 'no_access' | 'lookup_failed' | 'redirect';
const outcomes: DocumentOutcome[] = ['complete', 'error', 'empty', 'skipped', 'missing_relation', 'authenticated', 'unauthenticated', 'no_access', 'lookup_failed', 'redirect'];
type Config = { until: number; nonce: string };
type Carrier = { id: string; route: DocumentRoute; issued: number; until: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// One short-lived diagnostic setting, never an authorization credential. A new
// value must be explicitly provisioned for another measurement window.
function config(): Config | null {
  try {
    const value = JSON.parse(process.env.PORTAL_DOCUMENT_DIAGNOSTICS ?? 'null');
    if (!value || Object.keys(value).sort().join(',') !== 'nonce,until' || typeof value.until !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value.until) || typeof value.nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.nonce)) return null;
    const until = Date.parse(value.until), remaining = until - Date.now();
    return remaining > 0 && remaining <= WINDOW_MS ? { until, nonce: value.nonce } : null;
  } catch { return null; }
}

export function documentDiagnosticsEnabled(): boolean { return config() !== null; }

function documentRoute(pathname: string): DocumentRoute | null {
  if (pathname === '/staff/projects' || pathname === '/staff/site-visits') return pathname;
  return /^\/staff\/projects\/(?:proj_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname) ? '/staff/projects/[projectId]' : null;
}

function isDocument(headers: Headers, method: string): boolean {
  return method === 'GET' && headers.get('sec-fetch-dest') === 'document' && Boolean(headers.get('accept')?.includes('text/html')) && !headers.has('rsc') && !headers.has('next-router-prefetch') && !headers.has('next-router-segment-prefetch') && headers.get('purpose') !== 'prefetch';
}

function signature(payload: string, nonce: string): string { return createHmac('sha256', nonce).update(payload).digest('base64url'); }

function encode(carrier: Carrier, value: Config): string {
  const payload = Buffer.from(JSON.stringify(carrier)).toString('base64url');
  return `${payload}.${signature(payload, value.nonce)}`;
}

function decode(raw: string | null, value: Config): Carrier | null {
  if (!raw || raw.length > 512) return null;
  try {
    const parts = raw.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
    const expected = Buffer.from(signature(parts[0], value.nonce)), actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const c = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (Object.keys(c).sort().join(',') !== 'id,issued,route,until' || !uuid.test(c.id) || !routes.includes(c.route) || c.until !== value.until || !Number.isFinite(c.issued) || c.issued > Date.now() || c.until - c.issued > WINDOW_MS || Date.now() - c.issued > WINDOW_MS) return null;
    return c;
  } catch { return null; }
}

function ignoreFailure(operation: () => unknown): void {
  try { void Promise.resolve(operation()).catch(() => undefined); } catch { /* Diagnostics cannot change the page. */ }
}

export class DocumentDiagnostics {
  private readonly emitted = new Set<Phase>();
  constructor(private readonly carrier: Carrier) {}
  get id() { return this.carrier.id; }
  record(phase: Phase, startedAt: number, outcome: DocumentOutcome): void {
    const duration = performance.now() - startedAt;
    if (Date.now() >= this.carrier.until || !config() || this.emitted.has(phase) || !phases.includes(phase) || !outcomes.includes(outcome) || !Number.isFinite(duration) || duration < 0 || duration > WINDOW_MS) return;
    this.emitted.add(phase);
    const build = process.env.VERCEL_GIT_COMMIT_SHA;
    const region = process.env.VERCEL_REGION;
    ignoreFailure(() => console.info('[portal.document]', {
      event: 'portal.document.phase', requestId: this.carrier.id, routeTemplate: this.carrier.route,
      phase, outcome, durationMs: Number(duration.toFixed(1)),
      build: build && /^[a-f0-9]{40}$/.test(build) ? build : null,
      region: region && /^[a-z]{3}\d$/.test(region) ? region : null,
    }));
  }
  accessObserver(boundary: 'proxy' | 'rsc'): PortalAccessTimingObserver {
    return ({ phase, durationMs, outcome }) => this.record(`${boundary}.${phase}`, performance.now() - durationMs, outcome);
  }
  async measure<T>(phase: Phase, operation: () => PromiseLike<T> | T, classify: (value: T) => DocumentOutcome = () => 'complete'): Promise<T> {
    const start = performance.now();
    let result: T;
    try { result = await operation(); }
    catch (error) { ignoreFailure(() => this.record(phase, start, 'error')); throw error; }
    ignoreFailure(() => this.record(phase, start, classify(result)));
    return result;
  }
}

export function prepareProxyDocumentDiagnostics(request: Request): { requestHeaders?: Headers; diagnostics: DocumentDiagnostics | null } {
  const headers = new Headers(request.headers);
  const hadCarrier = headers.has(DOCUMENT_CARRIER_HEADER) || headers.has(DOCUMENT_ID_HEADER);
  headers.delete(DOCUMENT_CARRIER_HEADER); headers.delete(DOCUMENT_ID_HEADER);
  const value = config(), route = documentRoute(new URL(request.url).pathname);
  if (!value || !route || !isDocument(headers, request.method)) return { requestHeaders: hadCarrier ? headers : undefined, diagnostics: null };
  try {
    const carrier: Carrier = { id: randomUUID(), route, issued: Date.now(), until: value.until };
    headers.set(DOCUMENT_CARRIER_HEADER, encode(carrier, value));
    return { requestHeaders: headers, diagnostics: new DocumentDiagnostics(carrier) };
  } catch { return { requestHeaders: hadCarrier ? headers : undefined, diagnostics: null }; }
}

export function readDocumentDiagnostics(headers: Headers): DocumentDiagnostics | null {
  const value = config();
  if (!value || !isDocument(headers, 'GET')) return null;
  const carrier = decode(headers.get(DOCUMENT_CARRIER_HEADER), value);
  return carrier ? new DocumentDiagnostics(carrier) : null;
}
