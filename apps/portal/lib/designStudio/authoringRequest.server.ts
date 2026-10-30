import 'server-only';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { resolveEstimateVersionLabel } from '@/lib/estimates/loadProjectEstimateDetail';
import { mapEstimateMeta } from '@/lib/estimates/server';
import { loadEstimateQuoteEditability } from '@/lib/estimates/flow';
import { studioIdentifier } from './identifiers';
import { createStudioAuthoringEdit, projectStudioAuthoringView, type StudioAuthoringView } from './authoringView';
import { STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY } from './contracts';
import {projectStudioWebsiteBrief} from './websiteBrief.server';
import type {StudioWebsiteBrief} from './websiteBrief';
import {readStudioQuoteHandoff} from './quoteSnapshot';
import { studioDesignIdentity, type StudioDesignIdentity } from './studioDesignIdentity';
import { loadStudioProjectName } from '@/lib/queries/studioProject.server';
import {STUDIO_OPENING_TYPE,STUDIO_OPENING_FRAME_BYTES,STUDIO_PRICE_REQUEST_BYTES,STUDIO_PRICE_KEY_CHARACTERS,studioWebsitePricePayload,type StudioOpeningBinding} from './studioOpening';
import {studioOpeningResponse} from './studioOpening.server';
import {startStudioOpeningPricing} from './studioWebsitePricing.server';
import {loadPortalThemeForUser,portalThemeStyleVars} from '@/lib/theme/server';
import {createStudioRequestDiagnostics,type StudioRequestDiagnostics} from './studioRequestDiagnostics.server';

export type StudioAuthoringResponse = {
  state: 'ready' | 'needs-import' | 'unavailable';
  estimate: { id: string; projectId: string; versionLabel: string; updatedAt: string | null; requiresNewRevision: boolean };
  view: StudioAuthoringView | null;
  reason: string | null;
  nextAction: 'edit' | 'create-revision' | 'import' | 'website-import' | 'import-required' | 'unavailable';
  websiteBrief?: StudioWebsiteBrief;
  preparedQuote?: {snapshotId:string;contentHash:string;documentMode?:'separate_v1'};
  identity?: StudioDesignIdentity;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

async function readAuthoring(request: Request, ids: { projectId: string; estimateId: string },diagnostics:StudioRequestDiagnostics) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  if (request.method !== 'GET') return jsonError('Method not allowed', 405);
  const auth = await diagnostics.measure('guard',()=>request.headers.get('accept')===STUDIO_OPENING_TYPE
    ?requireStaffContext(diagnostics.context,true,'studio-opening'):requireStaffContext(diagnostics.context,false));
  if (!auth.ok) {
    if(request.headers.get('accept')===STUDIO_OPENING_TYPE&&'accessKind' in auth)
      auth.response.headers.set('x-studio-access-state',String(auth.accessKind));
    return auth.response;
  }
  if (auth.session.role !== 'staff' && auth.session.role !== 'admin') return jsonError('Staff access is required', 403);
  let project: ReturnType<typeof studioIdentifier>, estimate: ReturnType<typeof studioIdentifier>;
  try {
    project = studioIdentifier(ids.projectId, 'proj');
    estimate = studioIdentifier(ids.estimateId, 'est');
    if ([...new URL(request.url).searchParams.keys()].length) return jsonError('Invalid authoring query', 400);
  } catch { return jsonError('Invalid authoring identifier', 400); }

  let opening:ReturnType<typeof startStudioOpeningPricing>|null=null,handedOff=false;
  try {
  // All reads use the same freshly verified caller/RLS client. Association is
  // still checked first; speculative child results never admit a foreign row.
  const children = new AbortController();
  const cancelChildren = () => children.abort();
  request.signal.addEventListener('abort', cancelChildren, {once:true});
  if(request.signal.aborted)cancelChildren();
  const context = Promise.allSettled([
    diagnostics.measure('quote-authority',()=>loadEstimateQuoteEditability([estimate.uuid],auth.supabase,children.signal)),
    diagnostics.measure('version-metadata',()=>resolveEstimateVersionLabel(auth.supabase,project.uuid,estimate.uuid,children.signal)),
    diagnostics.measure('project-display',()=>loadStudioProjectName(auth.supabase,project.uuid,children.signal)),
    request.headers.get('accept')===STUDIO_OPENING_TYPE
      ?diagnostics.measure('theme',()=>loadPortalThemeForUser(auth.session.user.id,{client:auth.supabase,signal:children.signal}).then(portalThemeStyleVars)).catch(()=>({}))
      :Promise.resolve(null),
  ]);
  let row: Record<string,unknown>;
  let resolved: Awaited<typeof context>;
  let contextComplete=false;
  try {
    const result = await diagnostics.measure('target',()=>auth.supabase.from('estimates').select('*')
      .eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle());
    if (result.error) return jsonError('Could not load this saved design', 503);
    const target = record(result.data);
    if (!target || target.id !== estimate.uuid || target.project_id !== project.uuid) return jsonError('Estimate not found', 404);
    row=target;
    if(request.headers.get('accept')===STUDIO_OPENING_TYPE&&target.status==='draft'&&record(target.outputs)?.studio_authored)opening=startStudioOpeningPricing(auth,request.signal,project.appId);
    resolved=await context;
    contextComplete=true;
  } finally {
    // Settled results have handlers from the moment they start, including when
    // target failure returns without waiting for a remote child cancellation.
    if(!contextComplete)children.abort();
    request.signal.removeEventListener('abort',cancelChildren);
  }
  const [quotes,version,projectDisplay,theme]=resolved;
  if(quotes.status==='rejected')throw quotes.reason;
  if(version.status==='rejected')throw version.reason;
  if(projectDisplay.status==='rejected')throw projectDisplay.reason;
  const projected=diagnostics.start('projection');
  const editability=quotes.value.get(estimate.uuid),versionLabel=version.value,projectName=projectDisplay.value;
  if (!editability) return jsonError('Estimate not found', 404);
  // Retain the canonical name/date/status mapping without reconstructing detail
  // or exposing a subset's project-wide flow flags.
  const display = mapEstimateMeta(row,versionLabel);
  const requiresNewRevision = editability.isLocked || editability.hasDraftQuotes ||
    editability.draftQuoteCount > 0 || display.status === 'archived' || row.status === 'archived';
  const metadata = { id: estimate.appId, projectId: project.appId, versionLabel,
    updatedAt: typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at)) ? row.updated_at : null, requiresNewRevision };
  const outputs = record(row.outputs);
  const websiteBrief=projectStudioWebsiteBrief(row);
  let authoring: StudioAuthoringResponse;
  if (!outputs || !['draft', 'archived'].includes(String(row.status)) ||
    !(row.updated_at === null || (typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at))))) {
    authoring = { state: 'unavailable', estimate: metadata, view: null, reason: 'The saved design record is incomplete.', nextAction: 'unavailable' };
  } else if (!Object.hasOwn(outputs, STUDIO_OUTPUT_KEY)) {
    authoring = { state: 'unavailable', estimate: metadata, view: null, reason: 'This historical estimate remains available in its existing calculator and saved review. Start a new Studio design for website product choices.', nextAction: 'unavailable' };
  } else {
    const projected = projectStudioAuthoringView({ authored: outputs[STUDIO_OUTPUT_KEY], spatial: outputs[STUDIO_SPATIAL_OUTPUT_KEY] });
    authoring = projected.ok
      ? { state: 'ready', estimate: metadata, view: projected.value, reason: null, nextAction: requiresNewRevision ? 'create-revision' : 'edit' }
      : { state: 'unavailable', estimate: metadata, view: null, reason: 'This saved studio design cannot be edited by this client.', nextAction: 'unavailable' };
  }
  const handoff=authoring.state==='ready'&&!requiresNewRevision?readStudioQuoteHandoff(outputs):null;
  const publicAuthoring={...authoring,identity:studioDesignIdentity({...display,editability},projectName),...(websiteBrief?{websiteBrief}:{}),...(handoff?{preparedQuote:{snapshotId:handoff.snapshotId,contentHash:handoff.contentHash,...(handoff.schemaVersion==='studio_quote_snapshot.v2'?{documentMode:'separate_v1' as const}:{})}}:{})};
  projected();
  if(request.headers.get('accept')===STUDIO_OPENING_TYPE){
    const presentation={theme:theme.status==='fulfilled'?theme.value??{}:{}};
    const candidate=authoring.state==='ready'&&authoring.view&&!requiresNewRevision&&authoring.nextAction==='edit'
      ?studioWebsitePricePayload({designId:authoring.view.designId,revision:authoring.view.revision,composition:createStudioAuthoringEdit(authoring.view),design:null}):null;
    const scope={actorId:auth.session.user.id,role:auth.session.role,projectId:project.appId,estimateId:estimate.appId};
    let initial=candidate&&candidate.requestKey.length<=STUDIO_PRICE_KEY_CHARACTERS&&new TextEncoder().encode(JSON.stringify({...candidate.payload,requestKey:candidate.requestKey})).byteLength<=STUDIO_PRICE_REQUEST_BYTES?candidate:null;
    let binding:StudioOpeningBinding|null=initial?{actorId:auth.session.user.id,role:auth.session.role,projectId:project.appId,estimateId:estimate.appId,designId:initial.payload.designId,revision:initial.payload.revision,requestKey:initial.requestKey}:null;
    if(binding&&new TextEncoder().encode(JSON.stringify({kind:'authoring',scope,authoring:publicAuthoring,binding,presentation})+'\n').byteLength>STUDIO_OPENING_FRAME_BYTES){binding=null;initial=null;}
    if(!initial)opening?.cancel();
    const pricing=opening;
    const response=studioOpeningResponse({request,scope,authoring:publicAuthoring,binding,presentation,retire:()=>pricing?.cancel(),onTerminal:outcome=>diagnostics.finish(outcome,200),calculate:async signal=>{
      signal.throwIfAborted();
      if(!initial)return jsonError('This saved version is not available for initial pricing.',409);
      const prepared=await diagnostics.measure('price-preparation',async()=>{
        const {studioPriceComposition}=await import('./studioWebsitePricing.server');
        signal.throwIfAborted();
        return studioPriceComposition(outputs??{},'composition' in initial.payload?initial.payload.composition:null);
      });
      if(!prepared.ok)return jsonError(prepared.message,prepared.status);
      if(!pricing)throw Error('Opening pricing is unavailable.');
      return diagnostics.measure('price-calculation',()=>pricing.calculate({body:{...initial.payload,requestKey:initial.requestKey},composition:prepared.composition,preparedPricing:prepared.preparedPricing,resolved:null,signal}));
    }});
    handedOff=true;return response;
  }
  return jsonOk({ authoring: publicAuthoring });
  } finally {if(!handedOff)opening?.cancel();}
}

/** Caller-bound read only. The DTO owner strips opaque provenance and private
 * output fields for both staff and admins before anything reaches the browser. */
export async function loadStudioAuthoringRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  const diagnostics=createStudioRequestDiagnostics();
  let response: Response;
  let failed=false;
  try { response = await readAuthoring(request, ids,diagnostics); }
  catch { failed=true;response = jsonError('Saved design is temporarily unavailable. Please retry.', 503, null, { code: 'STUDIO_AUTHORING_UNAVAILABLE' }); }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Accept');
  diagnostics.apply(response);
  if(!response.headers.get('content-type')?.startsWith(STUDIO_OPENING_TYPE))diagnostics.finish(failed?'failure':'response',response.status);
  return response;
}
