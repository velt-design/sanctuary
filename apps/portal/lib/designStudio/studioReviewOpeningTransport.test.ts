import { afterEach, expect, it, vi } from 'vitest';
import { readStudioReviewOpening, StudioReviewProtectedFallback, studioReviewProtectedHref } from './studioReviewOpeningTransport';
import { STUDIO_REVIEW_OPENING_BYTES, STUDIO_REVIEW_OPENING_TYPE, STUDIO_REVIEW_OPENING_ACCEPT, STUDIO_REVIEW_PRICE_OPENING_TYPE } from './studioReviewOpening';
import { StudioOpeningAccessError } from './studioOpeningTransport';
import { studioDocumentCallback } from './studioEditRoute';

const expected = { projectId: 'proj_one', estimateId: 'est_one', quoteVersionId: null as string | null };
const envelope = (quoteVersionId: string | null = null) => ({ kind: 'review', scope: { actorId: 'fresh-server-actor', role: 'staff', projectId: expected.projectId, estimateId: expected.estimateId }, quoteVersionId,
  presentation: { theme: { '--portal-accent': '#123456' } }, response: { review: { estimate: { id: expected.estimateId, projectId: expected.projectId }, ...(quoteVersionId ? { quote: { id: quoteVersionId } } : {}) },
    ...(quoteVersionId ? { quoteDocument: { id: quoteVersionId, projectId: expected.projectId, sourceEstimateVersionId: expected.estimateId } } : {}) } });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': STUDIO_REVIEW_OPENING_TYPE } });
afterEach(() => vi.unstubAllGlobals());

it('derives a non-looping protected fallback solely from its validated full callback', () => {
  const callback = '/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001?quoteVersionId=qv_30000000-0000-4000-8000-000000000001';
  const fallback = studioReviewProtectedHref(callback);
  expect(fallback).toBe(callback + '&studioView=protected'); expect(studioDocumentCallback(fallback, true)).toBeNull();
  expect(() => studioReviewProtectedHref('https://foreign.invalid/review')).toThrow();
});

it('admits the fresh server scope only after full valid EOF and leaves completed transport un-aborted', async () => {
  let close!: () => void; const cancel = vi.fn(), value = envelope();
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(value))); close = () => controller.close(); }, cancel });
  const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(body, { headers: { 'content-type': STUDIO_REVIEW_OPENING_TYPE } })); vi.stubGlobal('fetch', fetcher);
  const outer = new AbortController(); let done = false;
  const opening = readStudioReviewOpening('/review', expected, outer.signal).then(v => { done = true; return v; });
  await Promise.resolve(); await Promise.resolve(); expect(done).toBe(false); close();
  expect(await opening).toEqual(value); expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin', headers: { accept: STUDIO_REVIEW_OPENING_ACCEPT } });
  outer.abort(); expect((fetcher.mock.calls[0][1] as any).signal.aborted).toBe(false); expect(cancel).not.toHaveBeenCalled();
});

it('accepts large canonical captures and quote text without changing any Edit frame budget', async () => {
  const value: any = envelope('qv_exact');
  value.response.quoteDocument.studioDesign = { images: [{ dataUrl: 'x'.repeat(3_799_999) }, { dataUrl: 'x'.repeat(3_799_999) }] };
  value.response.quoteDocument.introText = 'x'.repeat(469_763);
  expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThan(STUDIO_REVIEW_OPENING_BYTES);
  vi.stubGlobal('fetch', vi.fn(async () => json(value)));
  expect((await readStudioReviewOpening('/review', { ...expected, quoteVersionId: 'qv_exact' }, new AbortController().signal)).response).toEqual(value.response);
});

it.each(['wrong-target', 'wrong-quote', 'wrong-role', 'staff-costs', 'unsafe-theme'])('refuses %s before any private leaf can mount', async mode => {
  const value: any = envelope();
  if (mode === 'wrong-target') value.scope.estimateId = 'est_foreign';
  if (mode === 'wrong-quote') value.quoteVersionId = 'qv_foreign';
  if (mode === 'wrong-role') value.scope.role = 'viewer';
  if (mode === 'staff-costs') value.response.review.internalCosts = { total: 123 };
  if (mode === 'unsafe-theme') value.presentation.theme = { '--portal-accent': 'red; private' };
  vi.stubGlobal('fetch', vi.fn(async () => json(value)));
  await expect(readStudioReviewOpening('/review', expected, new AbortController().signal)).rejects.toThrow('saved review could not be loaded');
});

it.each(['unauthenticated', 'no_access', 'lookup_failed'])('retains exact fresh access refusal %s instead of a protected fallback', async kind => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401, headers: { 'x-studio-access-state': kind, 'x-studio-review-fallback': 'protected' } })));
  await expect(readStudioReviewOpening('/review', expected, new AbortController().signal)).rejects.toMatchObject({ kind });
});

it('only classifies the exact post-guard 413 fallback and bounds unknown oversized responses', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 413, headers: { 'x-studio-review-fallback': 'protected' } })));
  await expect(readStudioReviewOpening('/review', expected, new AbortController().signal)).rejects.toBeInstanceOf(StudioReviewProtectedFallback);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('private failure', { status: 413 })));
  const ordinary = await readStudioReviewOpening('/review', expected, new AbortController().signal).catch(e => e);
  expect(ordinary).not.toBeInstanceOf(StudioReviewProtectedFallback); expect(ordinary).not.toBeInstanceOf(StudioOpeningAccessError);
  expect(ordinary.message).not.toContain('private');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(STUDIO_REVIEW_OPENING_BYTES + 1), { headers: { 'content-type': STUDIO_REVIEW_OPENING_TYPE } })));
  await expect(readStudioReviewOpening('/review', expected, new AbortController().signal)).rejects.toBeInstanceOf(StudioReviewProtectedFallback);
});

it('retires a held response on withdrawal and never admits a truncated or malformed private body', async () => {
  let append!: () => void; const cancel = vi.fn(); const value = JSON.stringify(envelope());
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(value.slice(0, 20))); append = () => { try { c.enqueue(new TextEncoder().encode(value.slice(20))); c.close(); } catch {} }; }, cancel });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'content-type': STUDIO_REVIEW_OPENING_TYPE } })));
  const outer = new AbortController(), pending = readStudioReviewOpening('/review', expected, outer.signal); await Promise.resolve(); await Promise.resolve(); outer.abort(); append();
  await expect(pending).rejects.toThrow(); expect(cancel).toHaveBeenCalled();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('private malformed customer body', { headers: { 'content-type': STUDIO_REVIEW_OPENING_TYPE } })));
  await expect(readStudioReviewOpening('/review', expected, new AbortController().signal)).rejects.toThrow('The saved review could not be loaded.');
});


it.each(['mismatched','malformed','ambiguous-document','ambiguous-review'])('refuses %s historical draft variants rather than admitting a different frozen quote',async mode=>{
 const target={projectId:'proj_10000000-0000-4000-8000-000000000001',estimateId:'est_20000000-0000-4000-8000-000000000001',quoteVersionId:'qv_30000000-0000-4000-8000-000000000001'};
 const value:any=envelope(target.quoteVersionId);Object.assign(value.scope,target);delete value.scope.quoteVersionId;Object.assign(value.response.review.estimate,{id:target.estimateId,projectId:target.projectId});
 delete value.response.quoteDocument;value.response.review.quote=null;value.response.studioDraft={quoteVersionId:target.quoteVersionId};
 vi.stubGlobal('fetch',vi.fn(async()=>json(value)));await expect(readStudioReviewOpening('/review',target,new AbortController().signal)).resolves.toEqual(value);
 if(mode==='mismatched')value.response.studioDraft.quoteVersionId='qv_30000000-0000-4000-8000-000000000002';
 if(mode==='malformed')value.response.studioDraft.extra=true;
 if(mode==='ambiguous-document')value.response.quoteDocument={id:target.quoteVersionId,projectId:target.projectId,sourceEstimateVersionId:target.estimateId};
 if(mode==='ambiguous-review')value.response.review.quote={id:target.quoteVersionId};
 await expect(readStudioReviewOpening('/review',target,new AbortController().signal)).rejects.toThrow('The saved review could not be loaded.');
});

function priceWire() {
 const first:any=envelope(); first.response.review.nextAction={kind:'edit'};first.response.review.websiteComposition={designId:'design',revision:1};
 const binding={...first.scope,designId:'design',revision:1,requestKey:'exact-key'};first.binding=binding;
 const price={requestKey:'exact-key',designId:'design',revision:1,selectionDigest:'selection',publicationId:'publication',versionNumber:1,publicationContentHash:'content',pricingDigest:'price',status:'priced',amount:123,basis:'fa\u00e7ade'};
 let controller!:ReadableStreamDefaultController<Uint8Array>;
 const cancel=vi.fn(),body=new ReadableStream<Uint8Array>({start(c){controller=c;},cancel});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(body,{headers:{'content-type':STUDIO_REVIEW_PRICE_OPENING_TYPE,'x-studio-review-price-tail':'1'}})));
 const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)+'\n');
 return{first,binding,price,controller,cancel,encode,body};
}
it('admits editable controls before calculation, then consumes one exact price only after valid tail EOF',async()=>{
 const w=priceWire(),outer=new AbortController(),pending=readStudioReviewOpening('/review',expected,outer.signal);
 const bytes=w.encode(w.first);for(const byte of bytes)w.controller.enqueue(Uint8Array.of(byte));
 const opening=await pending;expect(opening.response).toEqual(w.first.response);let settled=false;void opening.openingPrice!.result.then(()=>{settled=true;});
 const tail=w.encode({kind:'price',binding:w.binding,result:{ok:true,price:w.price}}),accent=tail.indexOf(195);
 w.controller.enqueue(tail.slice(0,accent+1));w.controller.enqueue(tail.slice(accent+1));await Promise.resolve();expect(settled).toBe(false);
 w.controller.close();expect(await opening.openingPrice!.result).toEqual({ok:true,price:w.price});expect(w.body.locked).toBe(false);outer.abort();expect(w.cancel).not.toHaveBeenCalled();
});
it.each(['missing','third','wrong-binding','wrong-key','private-staff','invalid-utf8','unterminated','abort'])('keeps fields usable and retires an untrusted %s Review price tail',async mode=>{
 const w=priceWire(),outer=new AbortController(),pending=readStudioReviewOpening('/review',expected,outer.signal);w.controller.enqueue(w.encode(w.first));const opening=await pending;
 const frame:any={kind:'price',binding:{...w.binding},result:{ok:true,price:{...w.price}}};
 if(mode==='wrong-binding')frame.binding.actorId='previous-actor';if(mode==='wrong-key')frame.result.price.requestKey='old-key';if(mode==='private-staff')frame.result.price.internalCosts={materialsExGst:1};
 if(mode==='abort')outer.abort();else{if(mode==='invalid-utf8')w.controller.enqueue(Uint8Array.of(255));else if(mode!=='missing'){let bytes=w.encode(frame);if(mode==='unterminated')bytes=bytes.slice(0,-1);w.controller.enqueue(bytes);if(mode==='third')w.controller.enqueue(w.encode(frame));}w.controller.close();}
 expect((await opening.openingPrice!.result).ok).toBe(false);expect(opening.response).toEqual(w.first.response);
});
it.each(['foreign-design','foreign-scope','frozen','truncated'])('refuses an invalid %s first-price boundary before fields mount',async mode=>{
 const w=priceWire();if(mode==='foreign-design')w.first.binding.designId='other';if(mode==='foreign-scope')w.first.binding.projectId='other';if(mode==='frozen')w.first.response.review.nextAction={kind:'create-revision'};
 const pending=readStudioReviewOpening('/review',expected,new AbortController().signal);const bytes=w.encode(w.first);w.controller.enqueue(mode==='truncated'?bytes.slice(0,-1):bytes);w.controller.close();await expect(pending).rejects.toThrow();
});
