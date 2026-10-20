// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ACCESSORY_REVIEW_RATES, getDefaultInstalledSellingRates, loadCostingConfigV1 } from '@sp/costing';
import { prepareStudioCreation } from './createPreparation';
import { createStudioAuthoringEdit, mergeStudioAuthoringEdit, projectStudioAuthoringView } from './authoringView';
import { addWebsitePergola } from './websiteComposition';
import { calculateStudioCommercialPricing } from './studioCommercialPricing.server';
import { prepareStudioQuoteRequest } from './quotePrepare.server';
import { appendStudioDesignPages } from '../quotes/studioDesignPdf';
import type { StudioQuoteView } from './quoteSnapshot';

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
