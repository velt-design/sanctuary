import 'server-only';
import {studioClientDocumentsEnabled} from './clientDocuments.server';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { loadStudioReviewEstimateContext, loadStudioReviewReference } from './studioReviewEstimateContext.server';
import { createStudioReviewDiagnostics, type StudioReviewDiagnostics } from './studioReviewDiagnostics.server';
import { getQuoteVersionDetail } from '@/lib/quotes/server';
import { studioIdentifier as canonicalId } from './identifiers';
import { parseStudioAuthored, STUDIO_OUTPUT_KEY } from './contracts';
import { buildSavedEstimateReview } from './savedReview';
import { studioPriceUuid } from './pricedCandidate';
import { projectStudioWebsiteBrief } from './websiteBrief.server';
import { studioDesignIdentity } from './studioDesignIdentity';
import { readStudioQuoteHandoff } from './quoteSnapshot';
import {createStudioAuthoringEdit} from './authoringView';
import {studioWebsitePricePayload,STUDIO_PRICE_KEY_CHARACTERS,STUDIO_PRICE_REQUEST_BYTES,STUDIO_OPENING_FRAME_BYTES} from './studioOpening';
import {studioOpeningResponse} from './studioOpening.server';
import {startStudioOpeningPricing,studioPriceComposition} from './studioWebsitePricing.server';
import { STUDIO_REVIEW_OPENING_TYPE, STUDIO_REVIEW_OPENING_BYTES, STUDIO_REVIEW_OPENING_ACCEPT, STUDIO_REVIEW_PRICE_OPENING_TYPE } from './studioReviewOpening';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

async function readReview(request: Request, ids: { projectId: string; estimateId: string }, diagnostics: StudioReviewDiagnostics) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  if (request.method !== 'GET') return jsonError('Method not allowed', 405);
  const priceRepresentation = request.headers.get('accept') === STUDIO_REVIEW_OPENING_ACCEPT;
  const framed = priceRepresentation || request.headers.get('accept') === STUDIO_REVIEW_OPENING_TYPE;
  const auth = await diagnostics.measure('guard', () => framed ? requireStaffContext(diagnostics.context, true) : requireStaffContext(diagnostics.context));
  if (!auth.ok) {
    if (framed && 'accessKind' in auth) auth.response.headers.set('x-studio-access-state', String(auth.accessKind));
    return auth.response;
  }
  if (auth.session.role !== 'admin' && auth.session.role !== 'staff') return jsonError('Staff access is required', 403);

  let project: ReturnType<typeof canonicalId>, estimateId: ReturnType<typeof canonicalId>;
  let quoteId: ReturnType<typeof canonicalId> | null;
  try {
    project = canonicalId(ids.projectId, 'proj');
    estimateId = canonicalId(ids.estimateId, 'est');
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== 'quoteVersionId') || params.getAll('quoteVersionId').length > 1) {
      return jsonError('Invalid review query', 400);
    }
    quoteId = params.has('quoteVersionId') ? canonicalId(params.get('quoteVersionId')!, 'qv') : null;
  } catch {
    return jsonError('Invalid review identifier', 400);
  }

  const [context,clientDocumentsEnabled] = await Promise.all([
    loadStudioReviewEstimateContext(auth.supabase, request, project.uuid, estimateId.uuid, diagnostics, framed ? auth.session.user.id : undefined, !quoteId),
    quoteId ? Promise.resolve(false) : studioClientDocumentsEnabled(project.uuid,auth.session.user.id),
  ]);
  if (context.state === 'unavailable') throw Error('Saved design read failed.');
  if (context.state === 'missing') return jsonError('Estimate not found', 404);
  const { estimate, versionLabels, projectName } = context;

  const outputs = record(record(estimate.calculatorSnapshot)?.outputs);
  const hasAuthored = Boolean(outputs && Object.hasOwn(outputs, STUDIO_OUTPUT_KEY));
  const authored = hasAuthored ? parseStudioAuthored(outputs![STUDIO_OUTPUT_KEY]) : null;
  let quote = null;
  let studioDraft: { quoteVersionId: string } | undefined;
  const relatedQuotes: {id:string;status:string;label:string}[] = [];
  if (quoteId) {
    // The established detail loader is privileged. Prove caller visibility and
    // association first, then recheck its exact returned version before projection.
    const visible = await diagnostics.measure('quote-access', () => auth.supabase.from('quote_versions')
      .select('id,status,version_number,pricing_source_metadata,source_estimate_version_id,quotes!inner(project_id,commercial_scope_id,quote_ref)')
      .eq('id', quoteId.uuid).eq('source_estimate_version_id', estimateId.uuid)
      .eq('quotes.project_id', project.uuid).abortSignal(request.signal).maybeSingle());
    if (visible.error) return jsonError('Could not verify quote access', 503);
    const row = record(visible.data);
    const parent = record(Array.isArray(row?.quotes) ? row.quotes[0] : row?.quotes);
    if (!row || row.id !== quoteId.uuid || row.source_estimate_version_id !== estimateId.uuid ||
      parent?.project_id !== project.uuid || (parent.commercial_scope_id ?? null) !== (estimate.commercialScopeId ?? null)) {
      return jsonError('Quote not found for this estimate', 404);
    }
    const metadata = record(row.pricing_source_metadata);
    if (metadata && Object.hasOwn(metadata, 'studioQuoteDraft')) {
      if (!hasAuthored || metadata.studioQuoteDraft !== 'studio_quote_draft.v1' || row.status !== 'DRAFT') {
        return jsonError('Protected Studio draft is unsupported', 409);
      }
      studioDraft = { quoteVersionId: quoteId.appId };
    } else {
      quote = await diagnostics.measure('quote-detail', () => getQuoteVersionDetail(quoteId.appId));
      if (!quote || quote.id !== quoteId.appId || quote.projectId !== project.appId ||
        quote.sourceEstimateVersionId !== estimate.id ||
        (quote.commercialScopeId ?? null) !== (estimate.commercialScopeId ?? null) ||
        (quote.commercialScopeKind ?? 'base') !== (estimate.commercialScopeKind ?? 'base')) {
        return jsonError('Quote not found for this estimate', 404);
      }
    }
  } else if (hasAuthored) {
    // Retain the historic marker's independent bounded refusal/ambiguity check.
    // A list of recent modern versions must not hide an older unsupported marker.
    const visible = context.legacyDraft;
    if (!visible) return jsonError('Could not verify Studio draft access', 503);
    if (visible.error) return jsonError('Could not verify Studio draft access', 503);
    if (!Array.isArray(visible.data)) return jsonError('Could not verify Studio draft access', 503);
    if (visible.data.length > 1) return jsonError('Protected Studio draft association is ambiguous', 409);
    if (visible.data.length === 1) {
      const row = record(visible.data[0]);
      const parent = record(Array.isArray(row?.quotes) ? row.quotes[0] : row?.quotes);
      if (!row || !studioPriceUuid(row.id) || row.source_estimate_version_id !== estimateId.uuid ||
        parent?.project_id !== project.uuid || (parent.commercial_scope_id ?? null) !== (estimate.commercialScopeId ?? null)) {
        return jsonError('Quote not found for this estimate', 404);
      }
      if (record(row.pricing_source_metadata)?.studioQuoteDraft !== 'studio_quote_draft.v1' || row.status !== 'DRAFT') {
        return jsonError('Protected Studio draft is unsupported', 409);
      }
      studioDraft = { quoteVersionId: `qv_${row.id}` };
    }
    if (!studioDraft && (estimate.editability?.isLocked || estimate.editability?.hasDraftQuotes || estimate.editability?.draftQuoteCount > 0)) {
      const modern = await diagnostics.measure('related-quotes', () => auth.supabase.from('quote_versions')
        .select('id,status,version_number,source_estimate_version_id,quotes!inner(project_id,commercial_scope_id,quote_ref)')
        .eq('source_estimate_version_id',estimateId.uuid).eq('quotes.project_id',project.uuid)
        .is('pricing_source_metadata->studioQuoteDraft',null).order('created_at',{ascending:false}).abortSignal(request.signal).limit(20));
      if(modern.error || !Array.isArray(modern.data))return jsonError('Could not verify related quotes',503);
      for(const value of modern.data){
        const row=record(value),parent=record(Array.isArray(row?.quotes)?row.quotes[0]:row?.quotes);
        if(!row||!studioPriceUuid(row.id)||row.source_estimate_version_id!==estimateId.uuid||parent?.project_id!==project.uuid||(parent.commercial_scope_id??null)!==(estimate.commercialScopeId??null))return jsonError('Quote not found for this estimate',404);
        if(!['DRAFT','SENT','ACCEPTED','DECLINED','SUPERSEDED'].includes(String(row.status)))return jsonError('Quote version is unsupported',409);
        relatedQuotes.push({id:`qv_${row.id}`,status:String(row.status),label:`${typeof parent.quote_ref==='string'?parent.quote_ref:'Quote'} · v${Number.isSafeInteger(row.version_number)?row.version_number:'?'}`});
      }
    }
  }

  let sourceEstimate = null;
  if (authored?.ok && authored.value.provenance.sourceEstimateId) {
    let sourceId: ReturnType<typeof canonicalId> | null = null;
    try { sourceId = canonicalId(authored.value.provenance.sourceEstimateId, 'est'); } catch { /* Invalid historic identity remains unavailable. */ }
    if (sourceId && sourceId.appId !== estimate.id) {
      const source = await diagnostics.measure('source-reference', () => loadStudioReviewReference(auth.supabase, request, project.uuid, sourceId.uuid, versionLabels));
      if (source?.id === sourceId.appId && source.projectId === project.appId &&
        (source.commercialScopeId ?? null) === (estimate.commercialScopeId ?? null) &&
        (source.commercialScopeKind ?? 'base') === (estimate.commercialScopeKind ?? 'base')) sourceEstimate = source;
    }
  }
  const websiteBrief = !quoteId ? projectStudioWebsiteBrief({ id: estimateId.uuid, project_id: project.uuid, outputs }) : null;
  const review = await diagnostics.measure('projection', () => buildSavedEstimateReview({ estimate, quote, sourceEstimate, viewerRole: auth.session.role }));
  const handoff = !quoteId && review.websiteComposition && review.nextAction?.kind === 'edit' ? readStudioQuoteHandoff(outputs) : null;
  request.signal.throwIfAborted();
  const payload = { review: { ...review, ...(clientDocumentsEnabled?{clientDocumentsEnabled:true}:{}), ...(handoff ? {preparedQuote: {snapshotId:handoff.snapshotId,contentHash:handoff.contentHash,...(handoff.schemaVersion==='studio_quote_snapshot.v2'?{documentMode:'separate_v1' as const}:{})}} : {}),
    identity: studioDesignIdentity(estimate, projectName),
    ...(websiteBrief ? { websiteBrief } : {}) },
    ...(relatedQuotes.length ? { relatedQuotes } : {}),
    ...(quote ? { quoteDocument: quote } : {}),
    ...(studioDraft ? { studioDraft } : {}) };
  if (!framed) return jsonOk(payload);
  const scope = { actorId: auth.session.user.id, role: auth.session.role, projectId: project.appId, estimateId: estimateId.appId };
  const opening = { kind: 'review', scope, quoteVersionId: quoteId?.appId ?? null, presentation: { theme: context.theme }, response: payload };
  const candidate = priceRepresentation && !quoteId && !studioDraft && review.websiteComposition && review.nextAction?.kind === 'edit'
    ? studioWebsitePricePayload({designId:review.websiteComposition.designId,revision:review.websiteComposition.revision,composition:createStudioAuthoringEdit(review.websiteComposition),design:null}) : null;
  const initial = candidate && candidate.requestKey.length <= STUDIO_PRICE_KEY_CHARACTERS && new TextEncoder().encode(JSON.stringify({...candidate.payload,requestKey:candidate.requestKey})).byteLength <= STUDIO_PRICE_REQUEST_BYTES ? candidate : null;
  const binding = initial ? {...scope,designId:initial.payload.designId,revision:initial.payload.revision,requestKey:initial.requestKey} : null;
  const firstFrame = {...opening,binding};
  // A large valid Review keeps its ordinary protected JSON capability; an
  // optional price must never consume the document's transport budget.
  const priceTail = initial && binding && new TextEncoder().encode(JSON.stringify(firstFrame)+'\n').byteLength <= STUDIO_OPENING_FRAME_BYTES;
  const body = JSON.stringify(priceTail ? firstFrame : opening);
  if (new TextEncoder().encode(body+'\n').byteLength > STUDIO_REVIEW_OPENING_BYTES) return new Response(null, {status:413,headers:{'x-studio-review-fallback':'protected'}});
  if (!priceTail || !initial || !binding) return new Response(body, {headers:{'Content-Type':STUDIO_REVIEW_OPENING_TYPE,Vary:'Accept'}});
  const pricing = startStudioOpeningPricing(auth,request.signal,project.appId);
  const response = studioOpeningResponse({request,scope,binding,firstFrame,contentType:STUDIO_REVIEW_PRICE_OPENING_TYPE,retire:()=>pricing.cancel(),onTerminal:outcome=>diagnostics.finish(outcome==='price-response'?'response':'failure',200),calculate:async signal=>{
    signal.throwIfAborted();
    const prepared=await diagnostics.measure('price-preparation',()=>studioPriceComposition(outputs??{},'composition' in initial.payload?initial.payload.composition:null));
    if(!prepared.ok)return jsonError(prepared.message,prepared.status);
    return diagnostics.measure('price-calculation',()=>pricing.calculate({body:{...initial.payload,requestKey:initial.requestKey},composition:prepared.composition,preparedPricing:prepared.preparedPricing,resolved:null,signal}));
  }});
  response.headers.set('x-studio-review-price-tail','1');
  return response;
}

/** GET boundary for route composition; no raw errors, snapshots or caller roles escape. */
export async function reviewStudioSavedRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  const diagnostics = createStudioReviewDiagnostics();
  let response: Response, failed = false;
  try { response = await readReview(request, ids, diagnostics); }
  catch { failed = true; response = jsonError('Saved review is temporarily unavailable. Please retry.', 503, null, { code: 'STUDIO_REVIEW_UNAVAILABLE' }); }
  response.headers.set('Cache-Control', 'private, no-store');
  diagnostics.apply(response);
  if(response.headers.get('x-studio-review-price-tail')!=='1')diagnostics.finish(failed ? 'failure' : 'response', response.status);
  return response;
}
