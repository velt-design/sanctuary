// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CARRIER_HEADER, DOCUMENT_ID_HEADER, documentDiagnosticsEnabled, prepareProxyDocumentDiagnostics, readDocumentDiagnostics } from './documentDiagnostics';

const nonce = 'A'.repeat(43);
const project = '/staff/projects/proj_11111111-1111-4111-8111-111111111111';
function enable(ms = 60_000) { vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + ms).toISOString(), nonce })); }
function request(path = project, extra: Record<string,string> = {}) { return new Request(`https://portal.example${path}?secret=customer`, { headers: { 'sec-fetch-dest': 'document', accept: 'text/html', cookie: 'existing-session', ...extra } }); }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T00:00:00Z')); enable(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('bounded document diagnostics', () => {
  it('joins only fixed transport fields to the verified Marketing carrier and isolates async logging rejection', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const prepared = prepareProxyDocumentDiagnostics(request('/staff/marketing-performance', { [DOCUMENT_ID_HEADER]: 'hostile', [DOCUMENT_CARRIER_HEADER]: 'hostile' }));
    const scope = readDocumentDiagnostics(prepared.requestHeaders!)!;
    const value = {};
    await expect(scope.measureTransport('marketing.hub', () => value)).resolves.toBe(value);
    const event = log.mock.calls[0][1] as Record<string, unknown>;
    expect(event).toMatchObject({ event: 'portal.document.transport', requestId: prepared.diagnostics!.id, operation: 'marketing.hub', connection: 'unknown', outcome: 'not_observed', connectMs: null });
    expect(Object.keys(event).sort()).toEqual(['event', 'requestId', 'routeTemplate', 'operation', 'ordinal', 'connection', 'dispatchMs', 'headersWaitMs', 'bodyMs', 'connectMs', 'outcome', 'build', 'region'].sort());
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/hostile|customer|existing-session|nonce|carrier|secret/);
    log.mockImplementation(() => Promise.reject(new Error('logging')));
    await expect(scope.measureTransport('marketing.designer', () => value)).resolves.toBe(value);
    await Promise.resolve();
  });
  it.each([
    ['/staff/projects', {}], ['/staff/site-visits', {}], ['/staff/marketing-performance/child', {}],
    ['/api/staff/v1/marketing-performance/hub', {}], ['/staff/marketing-performance', { rsc: '1' }],
    ['/staff/marketing-performance', { 'next-router-prefetch': '1' }], ['/staff/marketing-performance', { 'next-router-segment-prefetch': '1' }],
    ['/staff/marketing-performance', { purpose: 'prefetch' }], ['/staff/marketing-performance', { 'next-router-state-tree': 'private' }],
    ['/staff/marketing-performance', { 'x-nextjs-data': '1' }], ['/staff/marketing-performance', { 'next-action': 'private' }],
    ['/staff/marketing-performance?_rsc=private', {}],
  ] as const)('does not widen transport observation to %s %s', async (path, extra) => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const prepared = prepareProxyDocumentDiagnostics(request(path, extra));
    const scope = prepared.requestHeaders ? readDocumentDiagnostics(prepared.requestHeaders) : null;
    const work = vi.fn(() => ({}));
    if (scope) await scope.measureTransport('marketing.hub', work); else work();
    expect(work).toHaveBeenCalledTimes(1); expect(log).not.toHaveBeenCalled();
  });
  it('keeps transport off for absent, forged, removed, replaced, expired and snapshot scopes', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const prepared = prepareProxyDocumentDiagnostics(request('/staff/marketing-performance'));
    const scope = readDocumentDiagnostics(prepared.requestHeaders!)!;
    const forged = new Headers(prepared.requestHeaders); forged.set(DOCUMENT_CARRIER_HEADER, 'forged');
    expect(readDocumentDiagnostics(forged)).toBeNull();
    const value = {}, work = vi.fn(() => value);
    vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', ''); expect(scope.measureTransport('rsc.identity', work)).toBe(value);
    enable(); vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW', 'production-snapshot'); expect(scope.measureTransport('marketing.hub', work)).toBe(value);
    vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW', '');
    vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + 60_000).toISOString(), nonce: 'B'.repeat(43) }));
    expect(scope.measureTransport('navigation.finance', work)).toBe(value);
    enable(); await vi.advanceTimersByTimeAsync(60_001); expect(scope.measureTransport('marketing.designer', work)).toBe(value);
    expect(work).toHaveBeenCalledTimes(4); expect(log).not.toHaveBeenCalled();
  });
  it('suppresses an admitted in-flight observation after its setting is removed without replacing its value', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const prepared = prepareProxyDocumentDiagnostics(request('/staff/marketing-performance'));
    const scope = readDocumentDiagnostics(prepared.requestHeaders!)!;
    let finish!: (value: object) => void;
    const pending = scope.measureTransport('marketing.hub', () => new Promise<object>(resolve => { finish = resolve; }));
    vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', '');
    const value = {}; finish(value); await expect(pending).resolves.toBe(value); expect(log).not.toHaveBeenCalled();
  });
  it('selects only the exact Marketing document and keeps the unchanged private event shape',()=>{
    const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
    const prepared=prepareProxyDocumentDiagnostics(request('/staff/marketing-performance'));
    const scope=readDocumentDiagnostics(prepared.requestHeaders!)!;
    scope.record('marketing.hub',performance.now(),'complete');
    expect(scope.routeTemplate).toBe('/staff/marketing-performance');
    expect(log.mock.calls[0][1]).toMatchObject({routeTemplate:'/staff/marketing-performance',requestId:prepared.diagnostics!.id});
    expect(Object.keys(log.mock.calls[0][1] as object).sort()).toEqual(['build','durationMs','event','outcome','phase','region','requestId','routeTemplate']);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/customer|existing-session|nonce|carrier|secret/);
    enable(30*60_000+1);expect(prepareProxyDocumentDiagnostics(request('/staff/marketing-performance')).diagnostics).toBeNull();
  });
  it.each([
    ['/staff/marketing-performance/child',{}],['/api/staff/v1/marketing-performance/hub',{}],
    ['/staff/marketing-performance',{rsc:'1'}],['/staff/marketing-performance',{'next-router-prefetch':'1'}],
    ['/staff/marketing-performance',{'next-router-segment-prefetch':'1'}],['/staff/marketing-performance',{purpose:'prefetch'}],
    ['/staff/marketing-performance',{'next-router-state-tree':'private'}],['/staff/marketing-performance',{'x-nextjs-data':'1'}],
    ['/staff/marketing-performance',{'next-action':'private'}],['/staff/marketing-performance?_rsc=private',{}],
  ] as const)('excludes alternate Marketing entry %s %s',(path,headers)=>{
    expect(prepareProxyDocumentDiagnostics(request(path,headers)).diagnostics).toBeNull();
  });
  it('excludes POST and snapshot Marketing entries, including an already-created scope carrier',()=>{
    const original=request('/staff/marketing-performance');
    expect(prepareProxyDocumentDiagnostics(new Request(original,{method:'POST'})).diagnostics).toBeNull();
    const prepared=prepareProxyDocumentDiagnostics(original);
    vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW','production-snapshot');
    expect(prepareProxyDocumentDiagnostics(original).diagnostics).toBeNull();
    expect(readDocumentDiagnostics(prepared.requestHeaders!)).toBeNull();
  });
  it.each([undefined, '', '{}', 'false', JSON.stringify({ until:'2099-01-01T00:00:00Z',nonce }), JSON.stringify({ until:'2026-10-20T23:59:00Z',nonce })])('fails closed for absent/invalid/expired configuration %s', value => {
    vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', value);
    const log=vi.spyOn(console,'info');
    const result=prepareProxyDocumentDiagnostics(request(project,{[DOCUMENT_CARRIER_HEADER]:'forged',[DOCUMENT_ID_HEADER]:'forged','x-other':'preserved'}));
    expect(result.diagnostics).toBeNull();expect(documentDiagnosticsEnabled()).toBe(false);
    expect(result.requestHeaders?.has(DOCUMENT_CARRIER_HEADER)).toBe(false);expect(result.requestHeaders?.get('x-other')).toBe('preserved');expect(result.requestHeaders?.get('cookie')).toBe('existing-session');expect(log).not.toHaveBeenCalled();
  });
  it.each([['/api/admin/performance/web-vitals',{}],['/staff/projects/new',{}],[project,{rsc:'1'}],[project,{'next-router-prefetch':'1'}],[project,{purpose:'prefetch'}],[project,{'sec-fetch-dest':'empty'}]] as const)('does not measure alternate/non-document entry %s %s',(path,extra)=>{
    const prepared=prepareProxyDocumentDiagnostics(request(path,extra));expect(prepared.diagnostics).toBeNull();expect(prepared.requestHeaders).toBeUndefined();
  });
  it('overwrites hostile or replayed input at every matching proxy boundary and verifies the signed server carrier',()=>{
    const first=prepareProxyDocumentDiagnostics(request(project,{[DOCUMENT_CARRIER_HEADER]:'spoofed',[DOCUMENT_ID_HEADER]:'customer-name'}));
    const scope=readDocumentDiagnostics(first.requestHeaders!);expect(scope?.id).toBe(first.diagnostics?.id);
    const replay=prepareProxyDocumentDiagnostics(request('/staff/site-visits',{[DOCUMENT_CARRIER_HEADER]:first.requestHeaders!.get(DOCUMENT_CARRIER_HEADER)!}));
    expect(replay.diagnostics?.id).not.toBe(scope?.id);
    const directRsc=prepareProxyDocumentDiagnostics(request('/staff/site-visits',{rsc:'1',[DOCUMENT_CARRIER_HEADER]:first.requestHeaders!.get(DOCUMENT_CARRIER_HEADER)!}));
    expect(readDocumentDiagnostics(directRsc.requestHeaders!)).toBeNull();
    const damaged=new Headers(first.requestHeaders);damaged.set(DOCUMENT_CARRIER_HEADER,damaged.get(DOCUMENT_CARRIER_HEADER)!.slice(0,-1)+'!');expect(readDocumentDiagnostics(damaged)).toBeNull();
  });
  it('emits a fixed identifier-free shape, once per phase, and stops within an in-flight expiry',()=>{
    const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);vi.stubEnv('VERCEL_REGION','bom1');vi.stubEnv('VERCEL_GIT_COMMIT_SHA','a'.repeat(40));
    const prepared=prepareProxyDocumentDiagnostics(request());const scope=readDocumentDiagnostics(prepared.requestHeaders!)!;
    scope.record('rsc.identity',performance.now(),'complete');scope.record('rsc.identity',performance.now(),'complete');
    expect(log).toHaveBeenCalledTimes(1);expect(Object.keys(log.mock.calls[0][1] as object).sort()).toEqual(['build','durationMs','event','outcome','phase','region','requestId','routeTemplate']);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/customer|existing-session|11111111|nonce|carrier|secret/);expect(log.mock.calls[0][1]).toMatchObject({routeTemplate:'/staff/projects/[projectId]',region:'bom1',phase:'rsc.identity'});
    vi.advanceTimersByTime(60_001);scope.record('rsc.role',performance.now(),'complete');expect(log).toHaveBeenCalledTimes(1);expect(readDocumentDiagnostics(prepared.requestHeaders!)).toBeNull();
  });
  it('retains result/error identity with synchronous or asynchronously rejected diagnostics',async()=>{
    const scope=prepareProxyDocumentDiagnostics(request()).diagnostics!;const result={private:'sentinel'};const error=new Error('private SQL body');
    vi.spyOn(console,'info').mockImplementationOnce(()=>{throw new Error('logger');}).mockImplementation(()=>Promise.reject(new Error('logger')));
    await expect(scope.measure('theme.settings',()=>result)).resolves.toBe(result);
    await expect(scope.measure('theme.preset',()=>Promise.reject(error))).rejects.toBe(error);
    await expect(scope.measure('theme.total',()=>result,()=>{throw new Error('classifier');})).resolves.toBe(result);
    await Promise.resolve();
  });
});
