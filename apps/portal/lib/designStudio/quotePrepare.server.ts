import {SANCTUARY_QUOTE_PRESENTATION_VERSION} from '@/lib/quotes/quotePresentation';
import {STUDIO_DOCUMENT_LAYOUT_VERSION} from '@sp/studio-documents/contract';
import 'server-only';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { resolvePublishedCostingConfigurationRecordV1 } from '@sp/costing/server';
import { roofFinishDescription, solvePergolaPreview } from '@sp/configurator/geometry';
import { pergolaLightSites } from '@sp/geometry';
import { describeBlinds, describeSidePanels, describeRoofBattens, describeLighting, effectiveLightingLayout } from '@sp/configurator/website';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';
import { mapCostingConfigurationVersion } from '@/lib/costing/configurationShared';
import { getCostingConfigurationVersionById } from '@/lib/costing/configurationResolver';
import { studioIdentifier } from './identifiers';
import { isStudioObject } from './contracts';
import { createStudioAuthoringEdit, projectStudioAuthoringView } from './authoringView';
import { readStudioRequestBody } from './readRequestBody.server';
import { calculateStudioCommercialPricing } from './studioCommercialPricing.server';
import { quoteReviewDigest } from './quoteReviewDigest.server';
import { STUDIO_QUOTE_SNAPSHOT_SCHEMA, studioCanonicalJson, type StudioQuoteHandoff, type StudioQuoteView } from './quoteSnapshot';
import { websiteJoinStates } from './websiteJoins';
import {quoteConnectionDescription} from './quoteConnectionDescription';
import {studioCustomerQuoteLines} from './quoteCustomerLines';
import {verifyStudioTravelForProject} from './studioTravelReceipt.server';
import {prepareStudioAtomicSource,normalizeStudioAtomicTravel} from './atomicQuoteSource.server';
import {studioInstallationEstimate} from './studioInstallationEstimate';
import {studioTravelTripPlanIssue} from './studioTravelPlan';
import {studioClientDocumentsEnabled} from './clientDocuments.server';
import {projectStudioClientDocument} from './clientDocumentProjection.server';
import {loadStudioProjectName} from '@/lib/queries/studioProject.server';
import {resolveEstimateVersionLabels} from '@/lib/estimates/loadProjectEstimateDetail';
import {STUDIO_CLIENT_QUOTE_SNAPSHOT_SCHEMA} from './quoteSnapshot';

export async function prepareStudioQuoteRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext(); if (!auth.ok) return auth.response;
  if (!['staff', 'admin'].includes(auth.session.role)) return jsonError('Staff access required', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonError('Request origin is not allowed', 403);
  try {
    const data=await buildStudioQuotePreparation(request,ids,auth);
    if(data instanceof Response)return data;
    const prepared=await getSupabaseServiceRole().rpc(data.separate?'studio_client_quote_prepare':'studio_website_quote_prepare',data.command);
    if(prepared.error)return jsonError(prepared.error.message.includes('stale')||prepared.error.message.includes('changed')
      ?'The saved design or publication changed. Reload Review before preparing again.':'The design could not be prepared. Your saved design is unchanged.',409);
    return jsonOk({snapshotId:data.command.p_snapshot_id,contentHash:data.command.p_content_hash,...(data.separate?{documentMode:'separate_v1'}:{}),totalIncGstCents:data.handoff.totalIncGstCents});
  } catch {
    return jsonError('The design could not be prepared. Check the saved design, site address and current price, then try again. Your saved design is unchanged.',422);
  }
}

type StudioQuoteCaller=Extract<Awaited<ReturnType<typeof requireStaffContext>>,{ok:true}>;
/** Shared fresh calculation owner. This function does not write or commit. */
export async function buildStudioQuotePreparation(request:Request,ids:{projectId:string;estimateId:string},auth:StudioQuoteCaller,
 atomic?:{command:import('./saveTransport').StudioPendingCommand}){
    const project = studioIdentifier(ids.projectId, 'proj'), estimate = studioIdentifier(ids.estimateId, 'est');
    const body = atomic ? {documentMode:'separate_v1',requestId:atomic.command.requestId,source:null} : await readStudioRequestBody(request, 8 * 1024 * 1024);
    const separate=isStudioObject(body)&&body.documentMode==='separate_v1';
    if(process.env.STUDIO_DOCUMENT_STAFF_TRIAL_ENABLED==='true'&&!separate)return jsonError('Prepare the quote with separate design documents. Reload Review and try again.',409);
    if (!isStudioObject(body) || Object.keys(body).sort().join(',') !== (separate?'documentMode,requestId,source':'images,requestId,source')
      || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)
      || (!separate&&(!Array.isArray(body.images) || body.images.length !== 2))) return jsonError('Invalid design preparation', 400);
    // These are all fresh reads. Start independent authority/display reads together,
    // rather than paying one database round trip for each on the Create path.
    const [enabled,result,publication,projectName,versionLabels] = await Promise.all([
      separate?studioClientDocumentsEnabled(project.uuid,auth.session.user.id):Promise.resolve(true),
      auth.supabase.from('estimates').select('id,project_id,commercial_scope_id,created_at,inputs,outputs,updated_at,status,warnings')
        .eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle(),
      separate?auth.supabase.from('costing_configuration_publication').select('current_version_id,version:costing_configuration_versions(*)').eq('singleton', true).maybeSingle()
        :auth.supabase.from('costing_configuration_publication').select('current_version_id').eq('singleton', true).maybeSingle(),
      separate?loadStudioProjectName(auth.supabase,project.uuid,request.signal):Promise.resolve(null),
      separate?resolveEstimateVersionLabels(auth.supabase,project.uuid,request.signal):Promise.resolve(null),
    ]);
    if(!enabled)return jsonError('Separate documents are unavailable for this project.',409);
    if (result.error) return jsonError('Could not verify saved design', 503);
    if (!result.data) return jsonError('Design not found', 404);
    const row = result.data;
    let view = projectStudioAuthoringView({ authored: row.outputs?.studio_authored, spatial: row.outputs?.drawing_object_first });
    if (!view.ok || (!atomic && studioCanonicalJson(view.value) !== studioCanonicalJson(body.source))) return jsonError('The saved design changed. Reload Review before preparing the quote.', 409);
    let save:Record<string,unknown>|undefined,atomicSource:ReturnType<typeof prepareStudioAtomicSource>|undefined;
    if(atomic){
      const result=prepareStudioAtomicSource(row,atomic.command);atomicSource=result;
      save=result.save;
      view=projectStudioAuthoringView({authored:result.authored,spatial:result.spatial});
      if(!view.ok)throw Error(view.message);
    }
    const images: StudioQuoteView['images'] = [];
    const pdf = await PDFDocument.create();
    for (let i = 0; !separate && i < 2; i++) {
      const item = (body.images as unknown[])[i], kind = i === 0 ? 'perspective' : 'plan';
      if (!isStudioObject(item) || Object.keys(item).sort().join(',') !== 'dataUrl,kind' || item.kind !== kind
        || typeof item.dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(item.dataUrl) || item.dataUrl.length > 3_800_000) throw Error('Capture both complete design views before preparing the quote.');
      const bytes = Buffer.from(item.dataUrl.split(',')[1], 'base64');
      const image = await pdf.embedPng(bytes);
      if (image.width < 640 || image.height < 400 || image.width > 2400 || image.height > 1800) throw Error('The design images need a readable size. Capture both views again.');
      images.push({ kind, dataUrl: item.dataUrl, width: image.width, height: image.height, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    const joinedVersion=publication.data&&'version' in publication.data?publication.data.version:null;
    const version=isStudioObject(joinedVersion)?joinedVersion:null;
    if (publication.error || !publication.data?.current_version_id || (separate&&version?.id!==publication.data.current_version_id)) throw Error('Published pricing is unavailable.');
    const configuration=separate?mapCostingConfigurationVersion(version):await getCostingConfigurationVersionById(publication.data.current_version_id,auth.supabase);
    const published = resolvePublishedCostingConfigurationRecordV1(configuration);
    let edit = createStudioAuthoringEdit(view.value),currentPrice:ReturnType<typeof calculateStudioCommercialPricing>|undefined;
    if(atomic&&save){
      const normalized=normalizeStudioAtomicTravel(edit,published.config);
      currentPrice=normalized.price;
      if(normalized.edit!==edit){
        const rebuilt=prepareStudioAtomicSource(row,{...atomic.command,edit:{...normalized.edit,revision:atomic.command.expectedRevision}});
        // Retry identity always retains the original command, never derived data.
        save=rebuilt.save;atomicSource=rebuilt;view=projectStudioAuthoringView({authored:rebuilt.authored,spatial:rebuilt.spatial});
        if(!view.ok)throw Error(view.message);edit=createStudioAuthoringEdit(view.value);
      }
    }
    const destinationCanonical=await verifyStudioTravelForProject(auth.supabase,project.appId,edit.site,request.signal,true);
    const travelContext=destinationCanonical?{schemaVersion:'studio_quote_travel.v1' as const,destinationCanonical}:undefined;
    const price = currentPrice??calculateStudioCommercialPricing(edit, published.config);
    const tripIssue=studioTravelTripPlanIssue(edit.site.travelAllowance,studioInstallationEstimate(price.siteOutput)?.siteDays??null);
    if(tripIssue)throw Error(tripIssue.message);
    const selections: StudioQuoteView['selections'] = price.resolvedObjects.map(object => {
      const design = object.design!, roof = design.roof;
      let lighting = roof.lighting;
      if (lighting) {
        const geometry = solvePergolaPreview(design.input, roof, object.geometryOptions).geometry;
        if (!geometry) throw Error('Lighting geometry is unavailable.');
        lighting = effectiveLightingLayout(pergolaLightSites(geometry.assembly, geometry.covering), lighting).selection;
      }
      return { label: object.object.label, details: [
        `${roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · ${design.input.widthMm} × ${design.input.projectionMm} mm`,
        roofFinishDescription(roof), `${roof.frameFinish==='white'?'White':'Black'} aluminium frame`, quoteConnectionDescription(object),
        ...(roof.blinds?.length ? [describeBlinds(roof.blinds)] : []), ...(roof.sidePanels?.length ? [describeSidePanels(roof.sidePanels)] : []),
        ...(roof.roofBattens ? [describeRoofBattens(roof.roofBattens)] : []), ...(lighting ? [describeLighting(lighting,'resolved')] : []),
      ] };
    });
    if (edit.spatial.houseAssembly?.houseForms.length) selections.push({ label: 'Existing house', details: ['Shown for design context. Existing house works are excluded unless stated in the quote.'] });
    for (const join of websiteJoinStates(edit)) {
      if (join.error) throw Error(join.error);
      selections.push({ label: 'Pergola join', details: [join.label, 'Pergolas positioned together as shown.'] });
    }
    selections.push(...price.customerStandaloneSelections);
    const lines = studioCustomerQuoteLines(price.breakdown, price.resolvedObjects.length, price.customerStandaloneSelections);
    const designVersionLabel=versionLabels?.get(estimate.uuid);
    if(separate&&(!designVersionLabel||!/^V[1-9][0-9]*(?:\.[0-9]+)?$/.test(designVersionLabel)))throw Error('The saved design version is unavailable.');
    const issuedAt=new Date().toISOString();
    const drawing=separate?projectStudioClientDocument(edit,{layoutVersion:STUDIO_DOCUMENT_LAYOUT_VERSION,snapshotId:body.requestId,designVersionLabel:designVersionLabel!,contentHash:'0'.repeat(64),projectName:projectName??'Sanctuary design',siteAddress:destinationCanonical??'',issuedAt,issuedDate:new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'short',year:'numeric',timeZone:'Pacific/Auckland'}).format(new Date(issuedAt)).toUpperCase()}):null;
    const drawingHash=drawing?{...drawing,contentHash:undefined,issuedAt:undefined,issuedDate:undefined}:undefined;
    const schemaVersion=separate?STUDIO_CLIENT_QUOTE_SNAPSHOT_SCHEMA:STUDIO_QUOTE_SNAPSHOT_SCHEMA;
    const contentHash = quoteReviewDigest({ source: view.value, resolved: price.resolvedObjects.map(object => ({ id: object.object.id, position: object.position, geometryOptions: object.geometryOptions, attachment: object.studioAttachment })),
      publication: published.provenance, lines, selections, ...(travelContext?{travelContext}:{}), views: images.map(({ kind, sha256, width, height }) => ({ kind, sha256, width, height })), renderVersion: separate?'studio-client-documents.v1':'studio-website.v2',...(separate?{quotePresentationVersion:SANCTUARY_QUOTE_PRESENTATION_VERSION}:{}),...(drawingHash?{drawing:drawingHash}:{}) });
    if(drawing)drawing.contentHash=contentHash;
    const handoff: StudioQuoteHandoff = { schemaVersion, snapshotId: body.requestId, contentHash, source: view.value,
      lines, totalIncGstCents: lines.reduce((sum, line) => sum + line.lineTotalIncGstCents, 0), approvalRequirement: price.approvalRequirement, approvalIncGstCents: price.approvalIncGstCents };
    const customerView: StudioQuoteView = { schemaVersion,...(separate?{documentMode:'separate_v1' as const,quotePresentationVersion:SANCTUARY_QUOTE_PRESENTATION_VERSION}:{}), snapshotId: body.requestId, contentHash,
      designId: view.value.designId, revision: view.value.revision, publicationVersion: published.provenance.versionNumber, selections, images,...(travelContext?{travelContext}:{}) };
    return {separate,command:{ p_project_id: project.uuid, p_estimate_id: estimate.uuid,
      p_actor_user_id: auth.session.user.id, p_snapshot_id: body.requestId, p_expected_updated_at: row.updated_at,
      p_authored: atomicSource?.authored??row.outputs.studio_authored, p_spatial: atomicSource?.spatial??row.outputs.drawing_object_first, p_publication_id: publication.data.current_version_id,
      p_content_hash: contentHash, p_handoff: handoff, p_private_evidence: { siteInputs: price.siteInputs, siteOutput: price.siteOutput, publication: published.provenance,...(separate?{configuration}:{}) }, p_customer_view: customerView,...(drawing?{p_drawing_source:drawing}:{}) },handoff,row,save};
}
