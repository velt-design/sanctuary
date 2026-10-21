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
