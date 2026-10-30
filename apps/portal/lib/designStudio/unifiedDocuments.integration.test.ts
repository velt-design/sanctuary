// @vitest-environment node
import { expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { loadCostingConfigV1, priceRafterLighting } from '@sp/costing';
import { buildReviewSiteInputs, configuratorAccessoryReview } from '@sp/configurator/server';
import { effectiveLightingLayout } from '@sp/configurator/website';
import { pergolaLightSites } from '@sp/geometry';
import { approvedStudioDocumentPages, parseStudioClientDocumentSource, STUDIO_DOCUMENT_LAYOUT_VERSION, studioDocumentPages } from '@sp/studio-documents/contract';
import { packStudioDrawing, unpackStudioDrawing } from '@sp/studio-documents/transport';
import { renderStudioDocumentPage } from '@sp/studio-documents/render';
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '../drawings/state/objectFirstWorkbenchModel';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { applyStudioHouseEdit } from './houseEditing';
import { addWebsitePergola, websiteComposition } from './websiteComposition';
import { changeStudioProduct, previewStudioAttachment, updateStudioHouse } from './studioHouseCommands';
import { previewStudioConnectionSwitch, studioConnectionSwitchTarget } from './studioConnectionSwitch';
import { studioHouseScene } from './studioHouseScene';
import { createStudioSceneResolver } from './interaction/resolvedScene';
import { projectStudioClientDocument } from './clientDocumentProjection.server';
import { approvedDrawingEdit } from '../../../../test/fixtures/studio-approved-drawings';

const identity = {
  layoutVersion: STUDIO_DOCUMENT_LAYOUT_VERSION,
  snapshotId: '10000000-0000-4000-8000-000000000030',
  contentHash: 'b'.repeat(64),
  designVersionLabel: 'V1',
  projectName: 'Synthetic unified Studio integration',
  siteAddress: '',
  issuedAt: '2026-10-30T00:00:00Z',
  issuedDate: '30 OCT 2026',
};
function fittedEdit() {
  let edit: StudioAuthoringEdit = { schemaVersion: 'studio_authoring_edit.v1', designId: 'unified-test', revision: 1, spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT), site: {}, objectOptions: [], deletions: [] };
  const made = applyStudioHouseEdit(edit.spatial, { kind: 'add', id: 'house' });
  if (!made.ok) throw Error(made.message);
  edit.spatial = made.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, { ...house, position: { ...house.position, rotationDeg: '37' } });
  edit = addWebsitePergola(edit, 'p');
  const value = structuredClone(websiteComposition(edit)[0].value!);
  value.rawDimensions.projectionMm = '4000';
  value.selection.input.projectionMm = 4000;
  value.facadeClearanceMm = '700';
  edit = changeStudioProduct(edit, value);
  edit = previewStudioAttachment(edit, { objectId: 'p', houseId: 'house', edge: 'left', kind: 'eave', method: 'soffit', alongEdgeMm: 500 });
  return previewStudioConnectionSwitch(edit, studioConnectionSwitchTarget(edit, 'p', 'facade')).edit;
}

// Full geometry, transport round trip and native PDF extraction share this correctness budget.
it('carries the fitted rotated house, exact binding, custom700 and canonical product geometry through saved ingress into immutable drawing-only sheets', async () => {
  const parsed = parseStudioAuthoringEdit(JSON.parse(JSON.stringify(fittedEdit())));
  if (!parsed.ok) throw Error(parsed.message);
  const edit = parsed.value;
  const row = websiteComposition(edit)[0];
  expect(row.studioAttachment).toMatchObject({ houseId: 'house', edge: 'left', method: 'facade' });
  expect(row.value!.facadeClearanceMm).toBe('700');
  const gap = row.attachment && 'measurements' in row.attachment && row.attachment.measurements!.roofClearanceMm;
  expect(gap).toBeGreaterThanOrEqual(700);
  expect(gap).toBeLessThan(701); // Authored House fitting rounds upward to the next millimetre.
  expect(Number(studioHouseScene(edit.site, edit.spatial)!.houses[0].eaveHeightMm)).toBeGreaterThan(2700);
  const live = createStudioSceneResolver().resolve(edit);
  const source = projectStudioClientDocument(edit, identity);
  expect(source.layoutVersion).toBe(STUDIO_DOCUMENT_LAYOUT_VERSION);
  expect(source.products[0].pose).toEqual(live.products[0].position);
  expect(source.products[0].assembly).toEqual(JSON.parse(JSON.stringify(live.products[0].geometry!.assembly)));
  expect(source.houses[0].model).toEqual(JSON.parse(JSON.stringify(live.houses[0].model)));
  expect(source.houses[0].pose).toEqual(live.scene.houses[0].position);
  expect(source.products[0].drawingDetails!.finish.material).toBe('acrylic');
  expect(studioDocumentPages(source).map(page => page.kind)).toEqual(['plan', 'iso', 'elevation']);
  expect(parseStudioClientDocumentSource(source)).toEqual(source);
  expect(await unpackStudioDrawing(await packStudioDrawing(source))).toEqual(source);
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document=await pdfjs.getDocument({data:await renderStudioDocumentPage(source,0)}).promise;
  const content=await (await document.getPage(1)).getTextContent();
  const text=content.items.map(item=>'str' in item?item.str:'').join(' ');await document.destroy();
  expect(text).toContain('SAVED HOUSE CONTEXT / CLIPPED TO THIS VIEW');
  expect(text).not.toContain('CONTINUES ON OVERVIEW');
  expect(text).not.toContain('A00');
  if(process.env.STUDIO_LEGACY_RENDERER_MODULE){
    const legacy={...source,layoutVersion:'studio-booklet-layout.v3' as const};legacy.pageManifest=approvedStudioDocumentPages(legacy);
    const previous=await import(/* @vite-ignore */ pathToFileURL(process.env.STUDIO_LEGACY_RENDERER_MODULE).href);
    expect(await renderStudioDocumentPage(legacy,1)).toEqual(await previous.renderStudioDocumentPage(legacy,1));
  }
}, 20_000);

it('keeps a frozen fitted document unchanged when a later manual clearance fails with the house fixed, then permits an explicit method-fit recovery', () => {
  const edit = fittedEdit();
  const source = projectStudioClientDocument(edit, identity);
  const frozen = JSON.stringify(source);
  const value = structuredClone(websiteComposition(edit)[0].value!);
  value.facadeClearanceMm = '1700';
  const invalid = changeStudioProduct(edit, value);
  expect(invalid.spatial.houseAssembly).toEqual(edit.spatial.houseAssembly);
  expect(websiteComposition(invalid)[0].error).toBeTruthy();
  expect(() => projectStudioClientDocument(invalid, identity)).toThrow('saved design');
  const repaired = previewStudioConnectionSwitch(invalid, studioConnectionSwitchTarget(invalid, 'p', 'facade')).edit;
  expect(websiteComposition(repaired)[0].error).toBeNull();
  expect(JSON.stringify(source)).toBe(frozen);
  const updated = projectStudioClientDocument(repaired, { ...identity, snapshotId: '10000000-0000-4000-8000-000000000031' });
  expect(updated.houses[0].model).not.toEqual(source.houses[0].model);
  expect(updated.products[0].assembly).toEqual(source.products[0].assembly);
  const attachment = websiteComposition(repaired)[0].attachment;
  const gap = attachment && 'measurements' in attachment && attachment.measurements!.roofClearanceMm;
  expect(gap).toBeGreaterThanOrEqual(1700);
  expect(gap).toBeLessThan(1701);
});

it('freezes the same eight Box spots used by authoring and accessory pricing while retaining selected blind covers and conditional pages', async () => {
  const edit = approvedDrawingEdit('acrylic');
  const live = createStudioSceneResolver().resolve(edit);
  const box = live.products.find(row => row.design!.roof.family === 'box')!;
  const layout = effectiveLightingLayout(pergolaLightSites(box.geometry!.assembly, box.geometry!.covering), box.design!.roof.lighting!);
  const source = projectStudioClientDocument(edit, identity);
  const frozenBox = source.products.find(product => product.id === box.object.id)!;
  expect(layout.rafters).toHaveLength(8);
  expect(frozenBox.drawingDetails!.lights.rafters).toEqual(JSON.parse(JSON.stringify(layout.rafters)));
  expect(frozenBox.drawingDetails!.lights.strips).toEqual(JSON.parse(JSON.stringify(layout.strips)));
  const configuration = loadCostingConfigV1();
  const prices = configuratorAccessoryReview(box.design!, buildReviewSiteInputs(box.design!, box.geometryOptions), configuration, { geometryOptions: box.geometryOptions });
  const line = prices.lines.find(line => line.label === 'Rafter lighting · 8 lights')!;
  expect(line).toBeTruthy();
  const expected = priceRafterLighting({ pergolaId: box.object.id, lightCount: 8, dimmer: false, acrylicEligible: true }, configuration.installedSellingRates?.rafterLighting);
  expect(expected.errors).toEqual([]);
  expect(line.amount).toBe(Math.round(expected.lightingSellIncCents / 100));
  expect(source.products[0].drawingDetails!.blinds.map(blind => blind.cover)).toEqual(['PELMET', 'PELMET', 'PELMET']);
  expect(studioDocumentPages(source).filter(page => page.objectId === frozenBox.id).map(page => page.kind)).toEqual(['plan', 'iso', 'elevation', 'lighting']);
  expect(studioDocumentPages(source).filter(page => page.objectId === source.products[0].id).map(page => page.kind)).toEqual(['plan', 'iso', 'elevation', 'lighting', 'blind-plan', 'blind-elevation']);
  expect(await unpackStudioDrawing(await packStudioDrawing(source))).toEqual(source);
});
