import 'server-only';
import { calculateConfiguratorPricing } from '@sp/configurator/server';
import { loadProjectEstimateDetail } from '@/lib/estimates/loadProjectEstimateDetail';
import { mergeStudioAuthoringEdit, projectStudioAuthoringView, createStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { calculateStudioCommercialPricing } from './studioCommercialPricing.server';
import { websiteComposition } from './websiteComposition';
import {websiteCompositionPriceEligibility} from './websiteCompositionEligibility';
import { resolvePublishedCostingConfigurationRecordV1 } from '@sp/costing/server';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getCostingConfigurationVersionById } from '@/lib/costing/configurationResolver';
import { readStudioRequestBody } from './readRequestBody.server';
import { studioIdentifier } from './identifiers';
import { parseStudioAuthored, isStudioObject } from './contracts';
import { resolveStudioWebsiteDesign, isEmptyWebsiteStart } from './websiteDesign';
import { quoteReviewDigest } from './quoteReviewDigest.server';
import { studioInternalCostSummary } from './studioInternalCostSummary.server';

export async function studioWebsitePriceRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext(); if (!auth.ok) return auth.response;
  if (!['staff', 'admin'].includes(auth.session.role)) return jsonError('Staff access is required', 403);
  if (request.method !== 'POST') return jsonError('Method not allowed', 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonError('Request origin is not allowed', 403);
  try {
    const project = studioIdentifier(ids.projectId, 'proj'), estimate = studioIdentifier(ids.estimateId, 'est');
    let body: unknown;
    try { body = await readStudioRequestBody(request, 2 * 1024 * 1024); } catch { return jsonError('Invalid or oversized design price request', 400); }
    if (!isStudioObject(body)) return jsonError('Invalid design price request', 400);
    const compositionRequest = Object.keys(body).sort().join(',') === 'composition,designId,requestKey,revision';
    if (!compositionRequest && (JSON.stringify(body).length > 20000 || (typeof body.requestKey === 'string' && body.requestKey.length > 14000))) return jsonError('Invalid or oversized design price request',400);
    if ((!compositionRequest && Object.keys(body).sort().join(',') !== 'design,designId,requestKey,revision') ||
      typeof body.designId !== 'string' || !Number.isSafeInteger(body.revision) || typeof body.requestKey !== 'string' || body.requestKey.length > 1000000 ||
      (!compositionRequest && (!isStudioObject(body.design) || typeof body.design.objectId !== 'string'))) return jsonError('Invalid design price request', 400);
    const design = body.design;
    const read = await auth.supabase.from('estimates').select('id,project_id,outputs,status').eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle();
    if (read.error) return jsonError('Could not verify estimate access', 503);
    if (!read.data) return jsonError('Estimate not found', 404);
    const stored = parseStudioAuthored(read.data.outputs?.studio_authored);
    if (!stored.ok || stored.value.designId !== body.designId || stored.value.revision !== body.revision ||
      (!compositionRequest && !(stored.value.objectOptions.some(row => row.objectId === (design as Record<string,unknown>).objectId && row.options.values.websiteDesign) || ((design as Record<string,unknown>).objectId === `${stored.value.designId}:pergola:1` && read.data.outputs?.drawing_object_first && isEmptyWebsiteStart({ revision: stored.value.revision, objectOptions: stored.value.objectOptions, spatial: read.data.outputs.drawing_object_first })))))
      return jsonError('The saved design changed. Reload before calculating.', 409);
    let composition: ReturnType<typeof websiteComposition> | null = null;
    let commercialEdit: StudioAuthoringEdit | null = null;
    if (compositionRequest) {
      const detail = await loadProjectEstimateDetail(project.appId, estimate.appId);
      if (!detail || detail.id !== estimate.appId || detail.projectId !== project.appId) return jsonError('Estimate not found',404);
      if (read.data.status !== 'draft' || detail.status !== 'draft' || detail.editability.isLocked || detail.editability.hasDraftQuotes || detail.editability.draftQuoteCount > 0)
        return jsonError('Create a new revision before calculating changed design choices.',409);
      const merged = mergeStudioAuthoringEdit({ storedAuthored: read.data.outputs.studio_authored, storedSpatial: read.data.outputs.drawing_object_first, edit: body.composition });
      if (!merged.ok) return jsonError(merged.message, merged.code === 'STUDIO_STALE' ? 409 : 422);
      const projected = projectStudioAuthoringView({ authored: merged.value.authored, spatial: merged.value.spatial });
      if (!projected.ok) return jsonError(projected.message,422);
      if (projected.value.spatial.decks.length || projected.value.spatial.openings.length) return jsonError('This design contains scope not supported by configured pricing.',422);
      composition = websiteComposition(projected.value);
      if (composition.some(item => item.error || !item.design)) return jsonError(composition.find(item => item.error)?.error ?? 'Add a valid pergola before calculating.',422);
      commercialEdit = createStudioAuthoringEdit(projected.value);
      const eligibility=composition.length ? websiteCompositionPriceEligibility(composition,projected.value.site.websiteJoins) : null;
      if(eligibility)return jsonError(eligibility,422);
    }
    const resolved = compositionRequest ? null : resolveStudioWebsiteDesign(body.design, (body.design as Record<string,unknown>).objectId as string);
    if (resolved && !resolved.ok) return jsonError(resolved.message, 422);
    if (!composition && (body.design as Record<string,unknown>).supportDatumMm !== undefined) return jsonError('Send the complete design to price its support datum.', 422);
    const publication = await auth.supabase.from('costing_configuration_publication').select('current_version_id').eq('singleton', true).maybeSingle();
    if (publication.error || !publication.data?.current_version_id) return jsonError('Published pricing is unavailable. Your design is kept.', 503);
    const version = await getCostingConfigurationVersionById(publication.data.current_version_id, auth.supabase);
    const published = resolvePublishedCostingConfigurationRecordV1(version);
    if (!published.config.accessoryRates || !published.config.installedSellingRates) return jsonError('The published accessory schedules are incomplete.', 503);
    let calculation, commercialCalculation:ReturnType<typeof calculateStudioCommercialPricing>|undefined;
    try { commercialCalculation = commercialEdit ? calculateStudioCommercialPricing(commercialEdit, published.config) : undefined;
      calculation = commercialCalculation ? { ...commercialCalculation, excluded: [] }
      : calculateConfiguratorPricing(resolved!.ok ? resolved!.value : (()=>{throw Error('Invalid design');})(), published.config).estimate; }
    catch(error) { return jsonError(error instanceof Error ? error.message : 'Check design and site selections.',422); }
    const identity = { requestKey: body.requestKey, designId: body.designId, revision: body.revision, ...(composition ? {} : {objectId:(body.design as Record<string,unknown>).objectId}),
      selectionDigest: quoteReviewDigest(composition ? body.composition : resolved!.ok ? resolved!.value : null), publicationId: publication.data.current_version_id, versionNumber: published.provenance.versionNumber,
      publicationContentHash: published.provenance.contentHash,
      pricingDigest: quoteReviewDigest({ selection:composition ? body.composition : resolved!.ok ? resolved!.value : null, publication:published.provenance }) };
    if (calculation.status !== 'priced') return jsonOk({ ...identity, status: 'unavailable', amount: null, reason: calculation.status === 'custom' ? calculation.reason : 'This design cannot currently be priced.' });
    if (calculation.excluded.length) return jsonOk({ ...identity, status: 'unavailable', amount: null, reason: calculation.excluded.join(' ') });
    const internalCosts = commercialCalculation ? studioInternalCostSummary(auth.session.role, commercialCalculation) : undefined;
    return jsonOk({ ...identity, status: 'priced', amount: calculation.amount, breakdown: calculation.breakdown, basis: calculation.basis, ...(internalCosts ? {internalCosts} : {}) });
  } catch { return jsonError('Could not calculate this design. Your selections are kept.', 503); }
}
