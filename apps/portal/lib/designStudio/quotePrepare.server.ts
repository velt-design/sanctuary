import 'server-only';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { resolvePublishedCostingConfigurationRecordV1 } from '@sp/costing/server';
import { roofFinishDescription } from '@sp/configurator/geometry';
import { describeBlinds, describeSidePanels, describeRoofBattens, describeLighting } from '@sp/configurator/website';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';
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

export async function prepareStudioQuoteRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext(); if (!auth.ok) return auth.response;
  if (!['staff', 'admin'].includes(auth.session.role)) return jsonError('Staff access required', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonError('Request origin is not allowed', 403);
  try {
    const project = studioIdentifier(ids.projectId, 'proj'), estimate = studioIdentifier(ids.estimateId, 'est');
    const body = await readStudioRequestBody(request, 8 * 1024 * 1024);
    if (!isStudioObject(body) || Object.keys(body).sort().join(',') !== 'images,requestId,source'
      || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)
      || !Array.isArray(body.images) || body.images.length !== 2) return jsonError('Invalid design preparation', 400);
    const result = await auth.supabase.from('estimates').select('id,project_id,outputs,updated_at,status')
      .eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle();
    if (result.error) return jsonError('Could not verify saved design', 503);
    if (!result.data) return jsonError('Design not found', 404);
    const row = result.data;
    const view = projectStudioAuthoringView({ authored: row.outputs?.studio_authored, spatial: row.outputs?.drawing_object_first });
    if (!view.ok || studioCanonicalJson(view.value) !== studioCanonicalJson(body.source)) return jsonError('The saved design changed. Reload Review before preparing the quote.', 409);
    const images: StudioQuoteView['images'] = [];
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 2; i++) {
      const item = body.images[i], kind = i === 0 ? 'perspective' : 'plan';
      if (!isStudioObject(item) || Object.keys(item).sort().join(',') !== 'dataUrl,kind' || item.kind !== kind
        || typeof item.dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(item.dataUrl) || item.dataUrl.length > 3_800_000) throw Error('Capture both complete design views before preparing the quote.');
      const bytes = Buffer.from(item.dataUrl.split(',')[1], 'base64');
      const image = await pdf.embedPng(bytes);
      if (image.width < 640 || image.height < 400 || image.width > 2400 || image.height > 1800) throw Error('The design images need a readable size. Capture both views again.');
      images.push({ kind, dataUrl: item.dataUrl, width: image.width, height: image.height, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    const publication = await auth.supabase.from('costing_configuration_publication').select('current_version_id').eq('singleton', true).maybeSingle();
    if (publication.error || !publication.data?.current_version_id) throw Error('Published pricing is unavailable.');
    const published = resolvePublishedCostingConfigurationRecordV1(await getCostingConfigurationVersionById(publication.data.current_version_id, auth.supabase));
    const edit = createStudioAuthoringEdit(view.value), price = calculateStudioCommercialPricing(edit, published.config);
    const selections: StudioQuoteView['selections'] = price.resolvedObjects.map(object => {
      const design = object.design!, roof = design.roof;
      return { label: object.object.label, details: [
        `${roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · ${design.input.widthMm} × ${design.input.projectionMm} mm`,
        roofFinishDescription(roof), `${roof.frameFinish==='white'?'White':'Black'} aluminium frame`, quoteConnectionDescription(object),
        ...(roof.blinds?.length ? [describeBlinds(roof.blinds)] : []), ...(roof.sidePanels?.length ? [describeSidePanels(roof.sidePanels)] : []),
        ...(roof.roofBattens ? [describeRoofBattens(roof.roofBattens)] : []), ...(roof.lighting ? [describeLighting(roof.lighting)] : []),
      ] };
    });
    if (edit.spatial.houseAssembly?.houseForms.length) selections.push({ label: 'Existing house', details: ['Shown for design context. Existing house works are excluded unless stated in the quote.'] });
    for (const join of websiteJoinStates(edit)) {
      if (join.error) throw Error(join.error);
      selections.push({ label: 'Pergola join', details: [join.label, 'Pergolas positioned together as shown.'] });
    }
    selections.push(...price.customerStandaloneSelections);
    const lines = studioCustomerQuoteLines(price.breakdown, price.resolvedObjects.length);
    const contentHash = quoteReviewDigest({ source: view.value, resolved: price.resolvedObjects.map(object => ({ id: object.object.id, position: object.position, geometryOptions: object.geometryOptions, attachment: object.studioAttachment })),
      publication: published.provenance, lines, selections, views: images.map(({ kind, sha256, width, height }) => ({ kind, sha256, width, height })), renderVersion: 'studio-website.v2' });
    const handoff: StudioQuoteHandoff = { schemaVersion: STUDIO_QUOTE_SNAPSHOT_SCHEMA, snapshotId: body.requestId, contentHash, source: view.value,
      lines, totalIncGstCents: lines.reduce((sum, line) => sum + line.lineTotalIncGstCents, 0), approvalRequirement: price.approvalRequirement, approvalIncGstCents: price.approvalIncGstCents };
    const customerView: StudioQuoteView = { schemaVersion: STUDIO_QUOTE_SNAPSHOT_SCHEMA, snapshotId: body.requestId, contentHash,
      designId: view.value.designId, revision: view.value.revision, publicationVersion: published.provenance.versionNumber, selections, images };
    const prepared = await getSupabaseServiceRole().rpc('studio_website_quote_prepare', { p_project_id: project.uuid, p_estimate_id: estimate.uuid,
      p_actor_user_id: auth.session.user.id, p_snapshot_id: body.requestId, p_expected_updated_at: row.updated_at,
      p_authored: row.outputs.studio_authored, p_spatial: row.outputs.drawing_object_first, p_publication_id: publication.data.current_version_id,
      p_content_hash: contentHash, p_handoff: handoff, p_private_evidence: { siteInputs: price.siteInputs, siteOutput: price.siteOutput, publication: published.provenance }, p_customer_view: customerView });
    if (prepared.error) return jsonError(prepared.error.message.includes('stale') || prepared.error.message.includes('changed')
      ? 'The saved design or publication changed. Reload Review before preparing again.' : 'The design could not be prepared. Your saved design is unchanged.', 409);
    return jsonOk({ snapshotId: body.requestId, contentHash, totalIncGstCents: handoff.totalIncGstCents });
  } catch {
    return jsonError('The design could not be prepared. Check the current price and capture both views again. Your saved design is unchanged.', 422);
  }
}
