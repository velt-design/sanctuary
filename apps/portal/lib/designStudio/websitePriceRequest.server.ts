import 'server-only';
import {STUDIO_PRICE_REQUEST_BYTES,STUDIO_PRICE_KEY_CHARACTERS} from './studioOpening';
import { loadStudioEstimateEditability } from './studioEstimateContext.server';
import type { prepareStudioCommercialPricing } from './studioCommercialPricing.server';
import { websiteComposition } from './websiteComposition';
import { jsonError, requireStaffContext } from '@/lib/api/staffApi';
import { readStudioRequestBody } from './readRequestBody.server';
import { studioIdentifier } from './identifiers';
import { parseStudioAuthored, isStudioObject } from './contracts';
import { resolveStudioWebsiteDesign, isEmptyWebsiteStart } from './websiteDesign';
import {calculateStudioWebsitePrice,studioPriceComposition,type StudioWebsitePricePayload} from './studioWebsitePricing.server';

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
    try { body = await readStudioRequestBody(request, STUDIO_PRICE_REQUEST_BYTES); } catch { return jsonError('Invalid or oversized design price request', 400); }
    if (!isStudioObject(body)) return jsonError('Invalid design price request', 400);
    const compositionRequest = Object.keys(body).sort().join(',') === 'composition,designId,requestKey,revision';
    if (!compositionRequest && (JSON.stringify(body).length > 20000 || (typeof body.requestKey === 'string' && body.requestKey.length > 14000))) return jsonError('Invalid or oversized design price request',400);
    if ((!compositionRequest && Object.keys(body).sort().join(',') !== 'design,designId,requestKey,revision') ||
      typeof body.designId !== 'string' || !Number.isSafeInteger(body.revision) || typeof body.requestKey !== 'string' || body.requestKey.length > STUDIO_PRICE_KEY_CHARACTERS ||
      (!compositionRequest && (!isStudioObject(body.design) || typeof body.design.objectId !== 'string'))) return jsonError('Invalid design price request', 400);
    const design = body.design;
    const read = await auth.supabase.from('estimates').select('id,project_id,outputs,status').eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle();
    if (read.error) return jsonError('Could not verify estimate access', 503);
    if (!read.data || read.data.id !== estimate.uuid || read.data.project_id !== project.uuid) return jsonError('Estimate not found', 404);
    const stored = parseStudioAuthored(read.data.outputs?.studio_authored);
    if (!stored.ok || stored.value.designId !== body.designId || stored.value.revision !== body.revision ||
      (!compositionRequest && !(stored.value.objectOptions.some(row => row.objectId === (design as Record<string,unknown>).objectId && row.options.values.websiteDesign) || ((design as Record<string,unknown>).objectId === `${stored.value.designId}:pergola:1` && read.data.outputs?.drawing_object_first && isEmptyWebsiteStart({ revision: stored.value.revision, objectOptions: stored.value.objectOptions, spatial: read.data.outputs.drawing_object_first })))))
      return jsonError('The saved design changed. Reload before calculating.', 409);
    let composition: ReturnType<typeof websiteComposition> | null = null;
    let preparedPricing: ReturnType<typeof prepareStudioCommercialPricing> | null = null;
    if (compositionRequest) {
      const editability = await loadStudioEstimateEditability(auth.supabase,project.uuid,estimate.uuid,read.data);
      if (!editability) return jsonError('Estimate not found',404);
      if (read.data.status !== 'draft' || editability.isLocked || editability.hasDraftQuotes || editability.draftQuoteCount > 0)
        return jsonError('Create a new revision before calculating changed design choices.',409);
      const prepared=await studioPriceComposition(read.data.outputs,body.composition);
      if(!prepared.ok)return jsonError(prepared.message,prepared.status);
      composition=prepared.composition;preparedPricing=prepared.preparedPricing;
    }
    const resolved = compositionRequest ? null : resolveStudioWebsiteDesign(body.design, (body.design as Record<string,unknown>).objectId as string);
    if (resolved && !resolved.ok) return jsonError(resolved.message, 422);
    if (!composition && (body.design as Record<string,unknown>).supportDatumMm !== undefined) return jsonError('Send the complete design to price its support datum.', 422);
    return await calculateStudioWebsitePrice({auth,projectId:project.appId,body:body as StudioWebsitePricePayload,composition,preparedPricing,resolved});
  } catch { return jsonError('Could not calculate this design. Your selections are kept.', 503); }
}
