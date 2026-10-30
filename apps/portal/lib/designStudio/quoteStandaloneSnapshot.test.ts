// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ACCESSORY_REVIEW_RATES, getDefaultInstalledSellingRates, loadCostingConfigV1 } from '@sp/costing';
import { prepareStudioCreation } from './createPreparation';
import { createStudioAuthoringEdit, mergeStudioAuthoringEdit, projectStudioAuthoringView } from './authoringView';
import { addWebsitePergola, websiteComposition } from './websiteComposition';
import type { StudioWebsiteDesign } from './websiteDesign';
import { solvePergolaPreview } from '@sp/configurator/geometry';
import { pergolaLightSites } from '@sp/geometry';
import { DEFAULT_LIGHTING, effectiveLightingLayout, describeLighting } from '@sp/configurator/website';
import { calculateStudioCommercialPricing } from './studioCommercialPricing.server';
import { prepareStudioQuoteRequest } from './quotePrepare.server';
import { appendStudioDesignPages } from '../quotes/studioDesignPdf';
import type { StudioQuoteView } from './quoteSnapshot';
import {signStudioSelectedAddress,signStudioTravelReceipt} from './studioTravelReceipt.server';
import {studioTravelTotalCents} from './studioTravelAllowance';
import {studioTravelPlanForReceipt} from './studioTravelPlan';
import {studioInstallationEstimate} from './studioInstallationEstimate';

const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>, config: {} as ReturnType<typeof loadCostingConfigV1>,
  calls: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext: async () => ({ ok: true, session: { role: 'staff', user: { id: 'staff' } }, supabase: {
    from: (table: string) => {
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ error: null, data: table === 'estimates' ? state.row : { current_version_id: 'publication' } }) };
      return query;
    },
  } }),
  jsonOk: (body: unknown) => Response.json(body),
  jsonError: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/supabaseClient', () => ({ getSupabaseServiceRole: () => ({
  rpc: async (name: string, args: Record<string, unknown>) => {
    expect(name).toBe('studio_website_quote_prepare');
    state.calls.push(structuredClone(args)); return { error: null, data: {} };
  },
}) }));
vi.mock('@/lib/costing/configurationResolver', () => ({ getCostingConfigurationVersionById: async () => ({}) }));
vi.mock('@/lib/projects/siteAddress.server',()=>({readProjectSiteAddress:async()=>({site_address:'12 Example Road, Auckland, New Zealand'})}));
vi.mock('@sp/costing/server', () => ({
  resolvePublishedCostingConfigurationRecordV1: () => ({ config: state.config, provenance: { versionNumber: 15 } }),
}));
const projectId = 'proj_10000000-0000-4000-8000-000000000001';
const estimateId = 'est_10000000-0000-4000-8000-000000000002';

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  state.calls.length = 0;
  state.config = { ...loadCostingConfigV1(), accessoryRates: structuredClone(ACCESSORY_REVIEW_RATES), installedSellingRates: getDefaultInstalledSellingRates() };
  vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO', '1');
  vi.stubEnv('STUDIO_TRAVEL_SIGNING_KEY','ab'.repeat(32));
});

it('saves and freezes the canonical 6×4 three-day travel plan, rejects stale/legacy plans, and preserves explicit/overnight quantities',async()=>{
 const made=prepareStudioCreation({mode:'blank',projectId,designId:'trip-days-quote-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const initial=made.prepared.row.outputs,projected=projectStudioAuthoringView({authored:initial.studio_authored,spatial:initial.drawing_object_first});if(!projected.ok)throw Error(projected.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(projected.value),'p');
 (edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions={widthMm:'6000',projectionMm:'4000'};
 const destinationCanonical='12 Example Road, Auckland, New Zealand';
 const receipt=signStudioTravelReceipt({projectId,destinationCanonical,placeId:'fixture_place',drivingCostPerRoundTripCents:5415,overnightEligible:false});
 const days=studioInstallationEstimate(calculateStudioCommercialPricing(edit,state.config).siteOutput)!.siteDays;
 expect(days).toBe(3);
 const plan=studioTravelPlanForReceipt(undefined,receipt,days);
 const bytes=await sharp({create:{width:640,height:400,channels:3,background:'#ffffff'}}).png().toBuffer(),dataUrl='data:image/png;base64,'+bytes.toString('base64');
 async function prepare(basis:typeof plan){
  edit.site={travelAllowance:basis,travelExGst:(studioTravelTotalCents(basis)/100).toFixed(2),siteAddressProof:signStudioSelectedAddress({projectId,destinationCanonical,placeId:'fixture_place'})};
  const merged=mergeStudioAuthoringEdit({storedAuthored:initial.studio_authored,storedSpatial:initial.drawing_object_first,edit});if(!merged.ok)throw Error(merged.message);
  const outputs={studio_authored:merged.value.authored,drawing_object_first:merged.value.spatial};
  state.row={id:estimateId.slice(4),project_id:projectId.slice(5),outputs,updated_at:'2026-10-20T00:00:00Z',status:'draft'};
  const source=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!source.ok)throw Error(source.message);
  return prepareStudioQuoteRequest(new Request('http://local.test/api/prepare',{method:'POST',headers:{origin:'http://local.test','content-type':'application/json'},body:JSON.stringify({requestId:'10000000-0000-4000-8000-000000000003',source:source.value,images:[{kind:'perspective',dataUrl},{kind:'plan',dataUrl}]})}),{projectId,estimateId});
 }
 expect((await prepare({...plan,plannedRoundTrips:'1'})).status).toBe(422);expect(state.calls).toHaveLength(0);
 const legacy={...plan};delete legacy.tripCountSource;
 expect((await prepare(legacy)).status).toBe(422);expect(state.calls).toHaveLength(0);
 expect((await prepare(plan)).status).toBe(200);expect(state.calls).toHaveLength(1);
 const frozen=structuredClone(state.calls[0]);
 expect((frozen.p_private_evidence as any).siteOutput).toMatchObject({site_days:3,add_ons:{travel_ex_gst:162.45}});
 expect((frozen.p_handoff as any).totalIncGstCents).toBe(Math.round(calculateStudioCommercialPricing(edit,state.config).amount*100));
 expect(JSON.stringify(frozen.p_customer_view)).not.toMatch(/site_days|crewHours|crew_hours|drivingCost|internalCosts/);
 expect((await prepare({...plan,tripCountSource:'manual',plannedRoundTrips:'2'})).status).toBe(200);
 expect((state.calls[1].p_private_evidence as any).siteOutput.add_ons.travel_ex_gst).toBe(108.30);
 expect((await prepare({...plan,tripCountSource:'overnight',plannedRoundTrips:'1',plannedNights:'2'})).status).toBe(200);
 expect((state.calls[2].p_private_evidence as any).siteOutput.add_ons.travel_ex_gst).toBe(654.15);
 expect(state.calls[0]).toEqual(frozen);
});

it('freezes priced standalone scope through the real preparation route and existing PDF selection renderer', async () => {
  const made = prepareStudioCreation({ mode: 'blank', projectId, designId: 'standalone-snapshot-proof', commercialScopeId: null });
  if (!made.ok) throw Error(made.message);
  const initial = made.prepared.row.outputs;
  const projected = projectStudioAuthoringView({ authored: initial.studio_authored, spatial: initial.drawing_object_first });
  if (!projected.ok) throw Error(projected.message);
  const edit = addWebsitePergola(createStudioAuthoringEdit(projected.value), 'p');
  edit.site = { access: 'normal', height: 'single_storey',
    additionalAluminium: { extrusionColour: 'Black', rows: [
      { id: 'a', profile: '100x100', stockLengthM: '6', quantity: '1' },
      { id: 'b', profile: '200x50', stockLengthM: '6', quantity: '2' },
    ] },
    standaloneInfills: { extrusionColour: 'White', items: [{
      id: 'i', label: 'Side opening', qty: '2', location: 'side', acrylicSource: 'auto', panelOrientation: 'auto',
      shape: { type: 'rect', widthM: '1.2', heightM: '0.6', bottomOffsetM: '0' },
      support: { edgeConfirmations: { top: 'yes', bottom: 'yes', left: 'yes', right: 'yes' }, internalSupportMode: 'center', internalSupportPositionsM: [] },
    }] },
    blinds: { items: [{ id: 'blind', label: 'Patio blind', system: 'ZIPTRAK', widthMm: '2000', coverLengthMm: '2100', fabric: 'MESH', motorised: 'YES', rollCover: 'PELMET' }] },
  };
  edit.site.siteAddressProof=signStudioSelectedAddress({projectId,destinationCanonical:'12 Example Road, Auckland, New Zealand',placeId:'fixture_place'});
  const merged = mergeStudioAuthoringEdit({ storedAuthored: initial.studio_authored, storedSpatial: initial.drawing_object_first, edit });
  if (!merged.ok) throw Error(merged.message);
  const outputs = { studio_authored: merged.value.authored, drawing_object_first: merged.value.spatial };
  outputs.studio_authored.provenance.sourcePayload = { internalCosts: 'PRIVATE-SENTINEL' };
  state.row = { id: estimateId.slice(4), project_id: projectId.slice(5), outputs, updated_at: '2026-10-20T00:00:00Z', status: 'draft' };
  const source = projectStudioAuthoringView({ authored: outputs.studio_authored, spatial: outputs.drawing_object_first });
  if (!source.ok) throw Error(source.message);
  const bytes = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  const requestId = '10000000-0000-4000-8000-000000000003';
  const response = await prepareStudioQuoteRequest(new Request('http://local.test/api/prepare', {
    method: 'POST', headers: { origin: 'http://local.test', 'content-type': 'application/json' },
    body: JSON.stringify({ requestId, source: source.value, images: [{ kind: 'perspective', dataUrl }, { kind: 'plan', dataUrl }] }),
  }), { projectId, estimateId });
  expect(await response.json()).toMatchObject({ snapshotId: requestId });
  expect(response.status).toBe(200); expect(state.calls).toHaveLength(1);
  const prepared = state.calls[0];
  const view = prepared.p_customer_view as StudioQuoteView;
  const quote = prepared.p_handoff as { totalIncGstCents: number; lines: Array<{ description: string }> };
  expect(quote.totalIncGstCents).toBe(Math.round(calculateStudioCommercialPricing(edit, state.config).amount * 100));
  expect(view.selections).toContainEqual({ label: 'Standalone aluminium · 100x100', details: ['Black aluminium', '1 full 6 m bar'] });
  expect(view.selections).toContainEqual({ label: 'Standalone aluminium · 200x50', details: ['Black aluminium', '2 full 6 m bars'] });
  expect(view.selections.find(row => row.label === 'Standalone infill · Side opening')?.details).toContain('2 openings · Side');
  expect(view.selections.find(row => row.label === 'Standalone blind · Patio blind')?.details).toContain('Mesh · Motorised · Pelmet');
  expect(JSON.stringify(view)).not.toMatch(/PRIVATE|cost_ex_gst|sales_ex_gst|multiplier/);
  expect(quote.lines.map(line => line.description).join(' ')).not.toContain('Selected standalone infills, aluminium and site allowances.');
  expect(prepared.p_snapshot_id).toBe(requestId);
  expect(prepared.p_content_hash).toBe(view.contentHash);

  // Exercise the unchanged PDF owner with the exact frozen customer projection.
  const pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), semibold = await pdf.embedFont(StandardFonts.HelveticaBold);
  await appendStudioDesignPages({ pdf, design: view, page: () => ({ page: pdf.addPage([595, 842]), top: 790 }),
    regular, semibold, ink: rgb(0, 0, 0), muted: rgb(.3, .3, .3), x: 40, width: 515, bottom: 50 });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const rendered = await pdfjs.getDocument({ data: await pdf.save() }).promise;
  let text = '';
  for (let page = 1; page <= rendered.numPages; page++) {
    const content = await (await rendered.getPage(page)).getTextContent();
    text += content.items.map(item => 'str' in item ? item.str : '').join(' ');
  }
  expect(text).toContain('Standalone aluminium'); expect(text).toContain('100x100');
  expect(text).toContain('1 full 6 m bar'); expect(text).toContain('200x50');
  expect(text).toContain('Rectangle'); expect(text).toContain('1200 mm');
  expect(text).toContain('Motorised'); expect(text).toContain('Pelmet');
  expect(text).not.toContain('PRIVATE');
  await rendered.destroy();
});


it('keeps a short frozen Studio selection heading and every detail on the same PDF page', async () => {
  const bytes = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const design: StudioQuoteView = { schemaVersion: 'studio_quote_snapshot.v1', snapshotId: 'pagination-proof', contentHash: 'frozen', designId: 'pagination', revision: 5, publicationVersion: 2,
    images: [{ kind: 'perspective', dataUrl: 'data:image/png;base64,' + bytes.toString('base64'), sha256: 'frozen', width: 640, height: 400 }],
    selections: [...Array.from({ length: 5 }, (_, index) => ({ label: 'Saved selection ' + index, details: ['First retained line ' + index, 'Second retained line ' + index] })),
      { label: 'Standalone aluminium: Black 100x100', details: ['Black aluminium', '2 full 6 m bars'] },
      { label: 'Long retained specification', details: Array.from({ length: 70 }, (_, index) => 'Retained detail ' + index) }] };
  const original = structuredClone(design), pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), semibold = await pdf.embedFont(StandardFonts.HelveticaBold);
  await appendStudioDesignPages({ pdf, design, page: () => ({ page: pdf.addPage([595, 842]), top: 790 }), regular, semibold, ink: rgb(0, 0, 0), muted: rgb(.3, .3, .3), x: 40, width: 515, bottom: 50 });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), rendered = await pdfjs.getDocument({ data: await pdf.save() }).promise;
  const pages: string[] = [];
  for (let page = 1; page <= rendered.numPages; page++) { const content = await (await rendered.getPage(page)).getTextContent(); pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' ')); }
  const headingPage = pages.findIndex(text => text.includes('Standalone aluminium: Black 100x100'));
  expect(headingPage).toBeGreaterThanOrEqual(0); expect(pages[headingPage]).toContain('Black aluminium'); expect(pages[headingPage]).toContain('2 full 6 m bars');
  const all = pages.join(' '); expect(all).toContain('Retained detail 0'); expect(all).toContain('Retained detail 69');
  expect(pages.filter(text => text.includes('Retained detail ')).length).toBeGreaterThan(1);
  expect(design).toEqual(original); await rendered.destroy();
});


it.each([{family:'mono',zero:false},{family:'gable',zero:false},{family:'mono',zero:true}] as const)('freezes effective $family lighting quantities including known-zero=$zero without changing the source', async ({family,zero}) => {
  const made = prepareStudioCreation({ mode: 'blank', projectId, designId: 'lighting-snapshot-proof', commercialScopeId: null });
  if (!made.ok) throw Error(made.message);
  const initial = made.prepared.row.outputs;
  const projected = projectStudioAuthoringView({ authored: initial.studio_authored, spatial: initial.drawing_object_first });
  if (!projected.ok) throw Error(projected.message);
  const edit = addWebsitePergola(addWebsitePergola(createStudioAuthoringEdit(projected.value), 'ceiling'), 'rafter');
  const ceiling = edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign;
  ceiling.rawDimensions = { widthMm: '5600', projectionMm: '3000' };
  ceiling.selection.roof.family = family; edit.spatial.pergolas[0].family = family;
  ceiling.selection.roof.finish = { material: 'solid', profile: 'corrugated', trayWidth: 400, ceiling: 'cedar-100', layout: 'central', acrylicBays: 2 };
  ceiling.selection.roof.lighting = { ...DEFAULT_LIGHTING, cedarPerSection: 4, cedarPattern: 'rows2', strips: ['unavailable-channel'] };
  if (zero) Object.assign(ceiling.selection.roof.lighting, { cedarIndividual:true, cedarOverrides:{'section-1':{count:0,pattern:'rows2'}} });
  const rafter = edit.objectOptions[1].values.websiteDesign as unknown as StudioWebsiteDesign;
  rafter.rawDimensions = { widthMm: '4825', projectionMm: '3125' };
  rafter.selection.roof.lighting = { ...DEFAULT_LIGHTING, rafterAmount: 'low', rafterCount: 99 };
  edit.site.siteAddressProof=signStudioSelectedAddress({projectId,destinationCanonical:'12 Example Road, Auckland, New Zealand',placeId:'fixture_place'});
  const merged = mergeStudioAuthoringEdit({ storedAuthored: initial.studio_authored, storedSpatial: initial.drawing_object_first, edit });
  if (!merged.ok) throw Error(merged.message);
  const outputs = { studio_authored: merged.value.authored, drawing_object_first: merged.value.spatial };
  const source = projectStudioAuthoringView({ authored: outputs.studio_authored, spatial: outputs.drawing_object_first });
  if (!source.ok) throw Error(source.message);
  state.row = { id: estimateId.slice(4), project_id: projectId.slice(5), outputs, updated_at: '2026-10-20T00:00:00Z', status: 'draft' };
  const original = structuredClone({ edit, source: source.value, outputs });
  const rows = websiteComposition(edit), lighting = rows.map(row => {
    const design = row.design!, geometry = solvePergolaPreview(design.input, design.roof, row.geometryOptions).geometry!;
    return effectiveLightingLayout(pergolaLightSites(geometry.assembly, geometry.covering), design.roof.lighting!).selection;
  });
  expect(lighting[0].cedarCount).toBe(zero ? 0 : family === 'mono' ? 4 : 8);
  expect(lighting[0].strips).toEqual([]); expect(lighting[1].rafterCount).toBe(4);
  const png = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  const response = await prepareStudioQuoteRequest(new Request('http://local.test/api/prepare', { method: 'POST', headers: { origin: 'http://local.test', 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: '10000000-0000-4000-8000-000000000003', source: source.value, images: [{ kind: 'perspective', dataUrl }, { kind: 'plan', dataUrl }] }) }), { projectId, estimateId });
  expect(response.status).toBe(200); expect(state.calls).toHaveLength(1);
  const view = state.calls[0].p_customer_view as StudioQuoteView, handoff = state.calls[0].p_handoff as { lines: Array<{ description: string }>; totalIncGstCents: number };
  const lines = handoff.lines.map(line => line.description).join(' ');
  for (let index = 0; index < lighting.length; index++) expect(view.selections[index].details).toContain(describeLighting(lighting[index],'resolved'));
  if (zero) { expect(view.selections[0].details.join(' ')).toContain('0 ceiling downlights'); expect(view.selections[0].details.join(' ')).not.toContain('4 ceiling downlights per section'); }
  if (zero) expect(lines).not.toContain('Ceiling downlights');
  else expect(lines).toContain('Ceiling downlights \u00b7 ' + lighting[0].cedarCount + ' lights');
  expect(lines).toContain('Rafter lighting \u00b7 4 lights');
  expect(handoff.totalIncGstCents).toBe(Math.round(calculateStudioCommercialPricing(edit, state.config).amount * 100));
  const pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), semibold = await pdf.embedFont(StandardFonts.HelveticaBold);
  await appendStudioDesignPages({ pdf, design: view, page: () => ({ page: pdf.addPage([595, 842]), top: 790 }), regular, semibold, ink: rgb(0, 0, 0), muted: rgb(.3, .3, .3), x: 40, width: 515, bottom: 50 });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), rendered = await pdfjs.getDocument({ data: await pdf.save() }).promise;
  let text = '';
  for (let page = 1; page <= rendered.numPages; page++) { const content = await (await rendered.getPage(page)).getTextContent(); text += content.items.map(item => 'str' in item ? item.str : '').join(' '); }
  const ceilingText=text.slice(text.indexOf(view.selections[0].label),text.indexOf(view.selections[1].label));
  expect(ceilingText).toContain(lighting[0].cedarCount + ' ceiling downlights'); expect(text).toContain('4 rafter spots');
  expect({ edit, source: source.value, outputs }).toEqual(original); await rendered.destroy();
});
