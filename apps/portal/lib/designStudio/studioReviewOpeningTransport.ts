import {studioOpeningPrice,STUDIO_OPENING_PRICE_MS,STUDIO_OPENING_FRAME_BYTES,type StudioOpeningBinding,type StudioOpeningPriceResult} from './studioOpening';
import { StudioOpeningAccessError, studioOpeningPresentation, studioOpeningBinding, studioOpeningPriceResult } from './studioOpeningTransport';
import { STUDIO_REVIEW_OPENING_BYTES, STUDIO_REVIEW_OPENING_TYPE, STUDIO_REVIEW_PRICE_OPENING_TYPE, STUDIO_REVIEW_OPENING_ACCEPT, type StudioReviewOpening } from './studioReviewOpening';
import { studioReviewCallback } from './studioEditRoute';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export class StudioReviewProtectedFallback extends Error {}
export function studioReviewProtectedHref(callback: string) {
  const exact = studioReviewCallback(callback, true);
  if (!exact) throw Error('Invalid protected Review destination.');
  const url = new URL(exact, 'https://studio-route.invalid'); url.searchParams.set('studioView', 'protected');
  return url.pathname + url.search;
}

/** Bounded Review JSON, or an explicit first record plus optional price tail.
 * Frozen/historical documents still require exact EOF before admission.
 * The frame owns startup/deadline/serial; this adapter owns only its transport. */
export async function readStudioReviewOpening(path: string, expected: { projectId: string; estimateId: string; quoteVersionId: string | null }, outer: AbortSignal): Promise<StudioReviewOpening> {
  const controller = new AbortController(); let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, completed = false, handedOff = false;
  const abort = () => { if (!completed) { controller.abort(); void reader?.cancel().catch(() => {}); } };
  outer.addEventListener('abort', abort, { once: true }); if (outer.aborted) abort();
  try {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { accept: STUDIO_REVIEW_OPENING_ACCEPT } });
    if (response.status === 413 && response.headers.get('x-studio-review-fallback') === 'protected') throw new StudioReviewProtectedFallback();
    if (!response.ok) {
      const denial = response.headers.get('x-studio-access-state');
      if (['unauthenticated', 'no_access', 'lookup_failed'].includes(denial ?? '')) throw new StudioOpeningAccessError(denial as 'unauthenticated' | 'no_access' | 'lookup_failed');
      throw Error('The saved review could not be loaded.');
    }
    const contentType=response.headers.get('content-type')?.split(';')[0],streamed=contentType===STUDIO_REVIEW_PRICE_OPENING_TYPE;
    if ((!streamed&&contentType!==STUDIO_REVIEW_OPENING_TYPE)||streamed!==(response.headers.get('x-studio-review-price-tail')==='1')||!response.body)throw Error('Invalid review response.');
    reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }), parts: string[] = []; let bytes = 0; let remaining = new Uint8Array(), delimited = false; 
    for (;;) {
      const next = await reader.read(); controller.signal.throwIfAborted();
      if (next.done) { parts.push(decoder.decode()); break; }
      bytes += next.value.byteLength; if (bytes > STUDIO_REVIEW_OPENING_BYTES) throw new StudioReviewProtectedFallback();
      if (streamed) {
        const newline = next.value.indexOf(10);
        if (newline >= 0) {
          if(bytes-next.value.byteLength+newline>STUDIO_OPENING_FRAME_BYTES)throw Error('Opening frame too large');
          parts.push(decoder.decode(next.value.subarray(0,newline), {stream:true}), decoder.decode());
          remaining = next.value.slice(newline+1); delimited = true;
          break;
        }
      }
      if(streamed&&bytes>STUDIO_OPENING_FRAME_BYTES)throw Error('Opening frame too large');
      parts.push(decoder.decode(next.value, { stream: true }));
    }
    if(streamed&&!delimited)throw Error('Incomplete opening');
    const value: unknown = JSON.parse(parts.join(''));
    if (!exact(value, ['kind', 'scope', 'quoteVersionId', 'presentation', 'response', ...(streamed?['binding']:[])]) || value.kind !== 'review' || value.quoteVersionId !== expected.quoteVersionId ||
      !exact(value.scope, ['actorId', 'role', 'projectId', 'estimateId']) || typeof value.scope.actorId !== 'string' || !value.scope.actorId || !['staff', 'admin'].includes(String(value.scope.role)) || value.scope.projectId !== expected.projectId || value.scope.estimateId !== expected.estimateId ||
      !object(value.response) || Object.keys(value.response).some(k => !['review', 'relatedQuotes', 'quoteDocument', 'studioDraft'].includes(k)) || !object(value.response.review) || !object(value.response.review.estimate) || value.response.review.estimate.id !== expected.estimateId || value.response.review.estimate.projectId !== expected.projectId ||
      (value.scope.role !== 'admin' && value.response.review.internalCosts !== undefined)) throw Error('Wrong review source.');
    const quote = value.response.quoteDocument, draft = value.response.studioDraft;
    // The canonical producer also supports an associated historic DRAFT marker,
    // without privileged frozen detail. It must never be mixed with that detail.
    const historic = exact(draft, ['quoteVersionId']) && typeof draft.quoteVersionId === 'string'
      && studioReviewCallback('/staff/design-studio/' + expected.projectId + '/' + expected.estimateId + '?quoteVersionId=' + encodeURIComponent(draft.quoteVersionId), true) !== null
      && (expected.quoteVersionId === null || draft.quoteVersionId === expected.quoteVersionId)
      && quote === undefined && value.response.review.quote == null;
    if (draft !== undefined && !historic) throw Error('Wrong historical draft source.');
    if (expected.quoteVersionId ? !historic && (!object(quote) || quote.id !== expected.quoteVersionId || quote.projectId !== expected.projectId || quote.sourceEstimateVersionId !== expected.estimateId || !object(value.response.review.quote) || value.response.review.quote.id !== expected.quoteVersionId) : quote !== undefined) throw Error('Wrong quote source.');
    studioOpeningPresentation(value.presentation);
    if (streamed) {
      const initial = value.binding;
      if (!studioOpeningBinding(initial) || Object.entries(value.scope).some(([key,v]) => initial[key as keyof StudioOpeningBinding] !== v) || expected.quoteVersionId || draft !== undefined || (value.response.review.nextAction as {kind?:unknown}|undefined)?.kind !== 'edit') throw Error('Wrong initial price source.');
      const view = value.response.review.websiteComposition;
      if (!object(view) || initial.designId !== view.designId || initial.revision !== view.revision) throw Error('Wrong initial price design.');
      const result = new Promise<StudioOpeningPriceResult>(resolve => {
        const timer = setTimeout(abort, STUDIO_OPENING_PRICE_MS);
        void (async () => {
          try {
            const tailDecoder = new TextDecoder('utf-8',{fatal:true}), tail = [tailDecoder.decode(remaining,{stream:true})]; let tailBytes=remaining.byteLength;
            if(tailBytes>STUDIO_OPENING_FRAME_BYTES)throw Error('Price frame too large');
            for (;;) { const next = await reader!.read(); controller.signal.throwIfAborted(); if(next.done){tail.push(tailDecoder.decode());break;} bytes += next.value.byteLength;tailBytes+=next.value.byteLength;if(tailBytes>STUDIO_OPENING_FRAME_BYTES)throw Error('Price frame too large');if(bytes>STUDIO_REVIEW_OPENING_BYTES)throw Error('Opening too large');tail.push(tailDecoder.decode(next.value,{stream:true})); }
            const text=tail.join(''); if(!text.endsWith('\n')||text.slice(0,-1).includes('\n'))throw Error('Invalid price tail');
            const frame:unknown=JSON.parse(text);
            if(!exact(frame,['kind','binding','result'])||frame.kind!=='price'||JSON.stringify(frame.binding)!==JSON.stringify(initial))throw Error('Wrong price source');
            const price=studioOpeningPriceResult(frame.result,initial);completed=true;resolve(price);
          } catch { resolve({ok:false,error:'The initial price could not be confirmed. Retry price to calculate these choices.'}); }
          finally {clearTimeout(timer);outer.removeEventListener('abort',abort);if(!completed)abort();reader?.releaseLock();}
        })();
      });
      handedOff=true;
      const opening={kind:value.kind,scope:value.scope,quoteVersionId:value.quoteVersionId,presentation:value.presentation,response:value.response};
      return {...opening,openingPrice:studioOpeningPrice(initial,result,abort)} as StudioReviewOpening;
    }
    completed = true; return value as StudioReviewOpening;
  } catch (error) {
    throw error instanceof StudioOpeningAccessError || error instanceof StudioReviewProtectedFallback ? error : Error('The saved review could not be loaded.');
  } finally {
    if(!handedOff){outer.removeEventListener('abort', abort); if (!completed) abort(); reader?.releaseLock();}
  }
}
