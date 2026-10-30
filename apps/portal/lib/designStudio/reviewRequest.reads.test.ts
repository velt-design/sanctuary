import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reviewStudioSavedRequest } from './reviewRequest.server';
import {readStudioReviewOpening} from './studioReviewOpeningTransport';
import {STUDIO_REVIEW_OPENING_ACCEPT} from './studioReviewOpening';
import { prepareStudioCreation } from './createPreparation';
import { buildSavedEstimateReview } from './savedReview';
import { mapEstimateDetail } from '@/lib/estimates/server';
import { computeEstimateEditability } from '@/lib/estimates/editability';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), quote: vi.fn(), theme: vi.fn(), pricing:vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth,
  jsonOk: (body: unknown) => Response.json(body), jsonError: (error: string, status: number, diagnostics: unknown, extra: Record<string, unknown>) => Response.json({ error, ...extra }, { status }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabaseServiceRole: {} }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: () => { throw Error('Do not reconstruct the caller client'); } }));
vi.mock('@/lib/quotes/server', () => ({ getQuoteVersionDetail: mocks.quote }));
vi.mock('./studioWebsitePricing.server',async original=>{const actual=await original<typeof import('./studioWebsitePricing.server')>();return{...actual,startStudioOpeningPricing:(...args:Parameters<typeof actual.startStudioOpeningPricing>)=>mocks.pricing(...args)??actual.startStudioOpeningPricing(...args)};});
vi.mock('@/lib/theme/server', () => ({loadPortalThemeForUser:mocks.theme,portalThemeStyleVars:(theme:unknown)=>theme}));

const project = '10000000-0000-4000-8000-000000000001', target = '10000000-0000-4000-8000-000000000002';
const source = '10000000-0000-4000-8000-000000000003', quote = '10000000-0000-4000-8000-000000000004';
const ids = { projectId: `proj_${project}`, estimateId: `est_${target}` };
type Result = { data: unknown; error: unknown };
type Read = { table: string; fields: string; filters: [string, unknown][]; signal?: AbortSignal; limit?: number };
let row: Record<string, any>, reference: Record<string, any> | null, history: Record<string, unknown>[];
let versions: any[], logs: any[], reads: Read[], held: Map<string, Promise<Result>>;
let targetError: unknown;

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const client = { from(table: string) {
  const read: Read = { table, fields: '', filters: [] };
  const execute = async (): Promise<Result> => {
    reads.push(read);
    const kind = table === 'estimates' ? read.fields === '*' ? read.filters.some(([key, value]) => key === 'id' && value === source) ? 'source' : 'target' : 'metadata' : table;
    if (table==='quote_versions'&&read.limit===2&&held.has('legacy'))return held.get('legacy')!;
    if (held.has(kind)) return held.get(kind)!;
    if (table === 'estimates') {
      if (read.fields !== '*') return { data: history, error: null };
      return kind === 'source' ? { data: reference, error: null } : { data: row, error: targetError };
    }
    if (table === 'projects') return { data: { id: project, name: 'TEST project' }, error: null };
    if (table === 'quote_send_logs') return { data: logs, error: null };
    if (table === 'quote_versions') return { data: read.limit ? [] : versions, error: null };
    throw Error(`Unexpected business read ${table}`);
  };
  const query: any = {
    select(fields: string) { read.fields = fields; return query; },
    eq(key: string, value: unknown) { read.filters.push([key, value]); return query; },
    in(key: string, value: unknown) { read.filters.push([key, value]); return query; },
    not() { return query; }, is() { return query; }, order() { return query; },
    limit(limit: number) { read.limit = limit; return query; },
    abortSignal(signal: AbortSignal) { read.signal = signal; return query; },
    maybeSingle: execute,
    then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) { return execute().then(resolve, reject); },
  };
  return query;
} };
function request(signal?: AbortSignal) { return reviewStudioSavedRequest(new Request('http://localhost/studio-review', { signal }), ids); }
beforeEach(() => {
  vi.clearAllMocks(); process.env.ENABLE_PORTAL_DESIGN_STUDIO = '1'; delete process.env.STUDIO_REQUEST_DIAGNOSTICS;
  const created = prepareStudioCreation({ mode: 'blank', projectId: ids.projectId, designId: 'public-read-fixture', commercialScopeId: null });
  if (!created.ok) throw Error(created.message);
  row = { ...created.prepared.row, id: target, project_id: project, status: 'draft', created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-27T00:00:00Z' };
  reference = null; history = [{ id: target, created_at: row.created_at, version: 3 }, { id: source, created_at: '2026-10-01', version: 2 }];
  versions = []; logs = []; reads = []; held = new Map(); targetError = null;
  mocks.auth.mockResolvedValue({ ok: true, session: { role: 'staff',user:{id:'fresh-server-actor'} }, supabase: client });
  mocks.theme.mockResolvedValue({'--portal-accent':'#123456'});
});
afterEach(() => { vi.unstubAllGlobals();vi.restoreAllMocks(); delete process.env.STUDIO_REQUEST_DIAGNOSTICS; });

it.each(['draft', 'archived'])('preserves the full public projection without unrelated project flow: %s', async status => {
  row.status = status;
  const before = structuredClone(row);
  const response = await request(), body = await response.json();
  const editability = computeEstimateEditability({ quoteVersions: [], sendLogs: [] });
  const legacy = mapEstimateDetail(row, 'V3', editability, { isActiveDraft: true, hasSentQuote: false,
    jobPackEligible: true, jobPackGeneratedAt: '2026-10-01', jobPackQuoteVersionId: `qv_${quote}` });
  const expected = buildSavedEstimateReview({ estimate: legacy, viewerRole: 'staff' });
  expected.identity = { ...expected.identity!, projectName: 'TEST project' };
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(body.review).toEqual(expected); expect(row).toEqual(before);
  expect(reads.map(r => r.table)).not.toContain('job_pack_generations');
  expect(reads.filter(r => r.table === 'estimates')).toHaveLength(2);
  expect(reads.find(r => r.fields === '*')!.filters).toEqual([['id', target], ['project_id', project]]);
  expect(reads.find(r => r.table === 'quote_versions' && !r.limit)!.filters).toEqual([['source_estimate_version_id', [target]]]);
  expect(body.review).not.toHaveProperty('isActiveDraft'); expect(body.review).not.toHaveProperty('jobPackEligible');
});

it('starts only caller-bound reads in parallel and withholds projection until the exact target', async () => {
  const pending = deferred<Result>(); held.set('target', pending.promise);
  let completed = false; const response = request().then(r => { completed = true; return r; });
  await vi.waitFor(() => expect(reads).toHaveLength(5));
  expect(reads.map(r => r.table)).toEqual(expect.arrayContaining(['estimates', 'quote_versions', 'projects']));
  expect(completed).toBe(false);
  pending.resolve({ data: row, error: null }); expect((await response).status).toBe(200);
});

it.each([['missing', 404], ['foreign', 404], ['failed', 503]])('target %s wins over failed children and cancels them', async (mode, status) => {
  const pending = deferred<Result>(); held.set('target', pending.promise);
  held.set('metadata', Promise.reject(Error('private child failure')));
  const never = deferred<Result>(); held.set('projects', never.promise);
  const response = request(); await vi.waitFor(() => expect(reads).toHaveLength(5));
  pending.resolve({ data: mode === 'missing' ? null : mode === 'foreign' ? { ...row, project_id: source } : row, error: mode === 'failed' ? Error('target secret') : null });
  const result = await response; expect(result.status).toBe(status); const body = await result.json(); expect(JSON.stringify(body)).not.toContain('secret');
  if (mode === 'failed') expect(body).toEqual({ error: 'Saved review is temporarily unavailable. Please retry.', code: 'STUDIO_REVIEW_UNAVAILABLE' });
  expect(reads.every(r => r.signal?.aborted)).toBe(true);
});

it('uses the real send-log authority to preserve quote-used state', async () => {
  versions = [{ id: quote, source_estimate_version_id: target, status: 'DRAFT', version_number: 1, quotes: { quote_ref: 'Q-TEST' } }];
  logs = [{ quote_version_id: quote, status: 'SENT', sent_at: '2026-10-20T00:00:00Z' }];
  const body = await (await request()).json();
  expect(body.review.nextAction.kind).toBe('create-revision'); expect(body.review.estimate.lock.isLocked).toBe(true);
  expect(reads.some(r => r.table === 'quote_send_logs')).toBe(true);
});

it.each(['quote_versions', 'quote_send_logs'])('fails closed when %s authority fails', async table => {
  versions = [{ id: quote, source_estimate_version_id: target, status: 'DRAFT' }];
  held.set(table, Promise.resolve({ data: null, error: Error('private quote failure') }));
  const response = await request(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private quote');
});

it.each(['unauthenticated', 'viewer'])('has zero business reads on %s denial', async kind => {
  mocks.auth.mockResolvedValue(kind === 'viewer' ? { ok: true, session: { role: 'viewer' }, supabase: client } : { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) });
  expect((await request()).status).toBe(kind === 'viewer' ? 403 : 401); expect(reads).toEqual([]);
});

it('keeps request cancellation on pending reads without a public design response', async () => {
  const abort = new AbortController(), pending = deferred<Result>(); held.set('target', pending.promise);
  const response = request(abort.signal); await vi.waitFor(() => expect(reads).toHaveLength(5)); abort.abort();
  expect(reads.every(r => r.signal?.aborted)).toBe(true);
  pending.resolve({ data: null, error: Error('aborted') }); expect((await response).status).toBe(503);
});

it('cannot publish a valid late target after the request is canceled', async () => {
  const abort = new AbortController(), pending = deferred<Result>(); held.set('target', pending.promise);
  const response = request(abort.signal); await vi.waitFor(() => expect(reads).toHaveLength(5)); abort.abort();
  pending.resolve({ data: row, error: null }); const result = await response;
  expect(result.status).toBe(503); expect(await result.text()).not.toContain('websiteComposition');
});

it.each(['same', 'foreign-project', 'foreign-scope', 'missing'])('keeps provenance reference exact and reuses sibling labels: %s', async kind => {
  row.outputs.studio_authored.provenance.sourceEstimateId = `est_${source}`;
  reference = kind === 'missing' ? null : { ...structuredClone(row), id: source,
    project_id: kind === 'foreign-project' ? target : project, commercial_scope_id: kind === 'foreign-scope' ? quote : null,
    outputs: {} };
  const body = await (await request()).json();
  expect(body.review.sourceEstimate.id).toBe(`est_${source}`);
  expect(body.review.sourceEstimate.versionLabel).toBe(kind === 'same' ? 'V2' : null);
  expect(reads.filter(r => r.table === 'estimates' && r.fields !== '*')).toHaveLength(1);
  expect(reads.filter(r => r.table === 'estimates' && r.fields === '*')).toHaveLength(2);
  expect(reads.some(r => r.table === 'job_pack_generations')).toBe(false);
});

it('retains reference read errors instead of presenting an invented source price', async () => {
  row.outputs.studio_authored.provenance.sourceEstimateId = `est_${source}`;
  held.set('source', Promise.resolve({ data: null, error: Error('private source failure') }));
  const result = await request(); expect(result.status).toBe(503); expect(await result.text()).not.toContain('private source');
});

it('keeps the legacy saved-price/refusal projection through the canonical mapper', async () => {
  row.outputs = { version: 3 }; row.inputs = {};
  const body = await (await request()).json();
  const expected = buildSavedEstimateReview({ estimate: mapEstimateDetail(row, 'V3', computeEstimateEditability({ quoteVersions: [], sendLogs: [] })), viewerRole: 'staff' });
  expected.identity = { ...expected.identity!, projectName: 'TEST project' };
  expect(body.review).toEqual(expected); expect(body.review.studio.state).toBe('absent');
});

it.each(['ready', 'denied', 'thrown'])('correlates the real %s route result without raw payload logging', async outcome => {
  process.env.STUDIO_REQUEST_DIAGNOSTICS = '1'; const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  if (outcome === 'denied') mocks.auth.mockResolvedValue({ ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) });
  if (outcome === 'thrown') mocks.auth.mockRejectedValue(Error('private actor token'));
  const response = await request();
  expect(response.status).toBe(outcome === 'ready' ? 200 : outcome === 'denied' ? 401 : 503);
  expect(warn).toHaveBeenCalledTimes(1); const entry = warn.mock.calls[0][1] as any;
  expect(entry.requestId).toBe(response.headers.get('x-portal-request-id'));
  expect(entry.event).toBe('studio.review_diagnostics'); expect(entry.outcome).toBe(outcome === 'thrown' ? 'failure' : 'response');
  expect(JSON.stringify(entry)).not.toMatch(/private|actor|token|websiteComposition|public-read-fixture/);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  if (outcome !== 'ready') expect(reads).toEqual([]);
});

it('overlaps same-actor theme with guarded context only for the framed representation',async()=>{
 const theme=deferred<Record<string,string>>();mocks.theme.mockReturnValue(theme.promise);
 let completed=false;const response=reviewStudioSavedRequest(new Request('http://localhost/studio-review',{headers:{accept:'application/x-sanctuary-studio-review+json'}}),ids).then(r=>{completed=true;return r;});
 await vi.waitFor(()=>expect(mocks.theme).toHaveBeenCalledOnce());expect(completed).toBe(false);expect(reads).toHaveLength(5);expect(mocks.theme.mock.calls[0][0]).toBe('fresh-server-actor');expect(mocks.theme.mock.calls[0][1]).toMatchObject({client,signal:expect.any(AbortSignal)});
 theme.resolve({'--portal-accent':'#123456'});const body=JSON.parse((await(await response).text()).split('\n')[0]);expect(body.scope.role).toBe('staff');expect(body.response.review.internalCosts).toBeUndefined();expect(body.presentation.theme).toEqual({'--portal-accent':'#123456'});
 mocks.theme.mockClear();expect((await request()).status).toBe(200);expect(mocks.theme).not.toHaveBeenCalled();
});
it('retains default presentation fallback on a framed theme error without granting private admin costs',async()=>{
 mocks.theme.mockRejectedValue(Error('private theme error'));const response=await reviewStudioSavedRequest(new Request('http://localhost/studio-review',{headers:{accept:'application/x-sanctuary-studio-review+json'}}),ids),body=JSON.parse((await response.text()).split('\n')[0]);expect(response.status).toBe(200);expect(body.presentation.theme).toEqual({});expect(body.response.review.internalCosts).toBeUndefined();
});

it('starts the bounded legacy-marker read before the exact target resolves and still waits/refuses its unsupported result',async()=>{
 const targetRead=deferred<Result>(),legacyRead=deferred<Result>();held.set('target',targetRead.promise);held.set('legacy',legacyRead.promise);
 let completed=false;const pending=request().then(r=>{completed=true;return r;});await vi.waitFor(()=>expect(reads.some(r=>r.table==='quote_versions'&&r.limit===2)).toBe(true));
 expect(completed).toBe(false);targetRead.resolve({data:row,error:null});await Promise.resolve();expect(completed).toBe(false);
 legacyRead.resolve({data:[{id:quote,status:'DRAFT',source_estimate_version_id:target,quotes:{project_id:project,commercial_scope_id:null},pricing_source_metadata:{studioQuoteDraft:'future'}}],error:null});expect((await pending).status).toBe(409);
});
it('reuses the fresh Review guard, exact target and quote authority for its bound initial price without another request',async()=>{
 const tail=deferred<Response>(),calculate=vi.fn((_args:unknown)=>tail.promise),cancel=vi.fn();mocks.pricing.mockReturnValue({calculate,cancel});
 const response=await reviewStudioSavedRequest(new Request('http://localhost/studio-review',{headers:{accept:STUDIO_REVIEW_OPENING_ACCEPT}}),ids);
 expect(response.headers.get('x-studio-review-price-tail')).toBe('1');vi.stubGlobal('fetch',vi.fn(async()=>response));const opening=await readStudioReviewOpening('/review',{...ids,quoteVersionId:null},new AbortController().signal);const first={response:opening.response,binding:opening.openingPrice!.binding};
 expect(first.response.review.nextAction.kind).toBe('edit');expect(mocks.auth).toHaveBeenCalledOnce();expect(reads.filter(r=>r.table==='estimates'&&r.fields==='*')).toHaveLength(1);expect(reads.filter(r=>r.table==='quote_versions'&&!r.limit)).toHaveLength(1);
 await vi.waitFor(()=>expect(calculate).toHaveBeenCalledOnce());const args=calculate.mock.calls[0][0] as any;
 expect(args.body.requestKey).toBe(first.binding.requestKey);expect(args.body.designId).toBe(first.binding.designId);expect(args.body.revision).toBe(first.binding.revision);expect(args.preparedPricing).toBeTruthy();
 expect(mocks.pricing.mock.calls[0][0].supabase).toBe(client);expect(mocks.pricing.mock.calls[0][2]).toBe(ids.projectId);
 tail.resolve(Response.json({requestKey:first.binding.requestKey,designId:first.binding.designId,revision:first.binding.revision,status:'unavailable',amount:null,publicationId:'fixture-publication',versionNumber:1,selectionDigest:'selection',pricingDigest:'price',publicationContentHash:'content'}));expect(await opening.openingPrice!.result).toMatchObject({ok:true,price:{status:'unavailable',requestKey:first.binding.requestKey}});expect(cancel).toHaveBeenCalledOnce();expect(mocks.auth).toHaveBeenCalledOnce();
});
