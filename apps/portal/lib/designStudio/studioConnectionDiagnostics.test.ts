import {DEFAULT_ROOF_FINISH} from '@sp/geometry';
import { expect, it } from 'vitest';
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '../drawings/state/objectFirstWorkbenchModel';
import type { StudioAuthoringEdit } from './authoringView';
import { applyStudioHouseEdit } from './houseEditing';
import { addWebsitePergola, websiteComposition } from './websiteComposition';
import { changeStudioProduct, previewStudioAttachment, updateStudioHouse } from './studioHouseCommands';
import { studioHouseScene } from './studioHouseScene';
import { StudioConnectionError } from './studioConnectionDiagnostics';
import { studioConnectionPresentation } from './studioConnectionPresentation';

function fixture() {
  let edit: StudioAuthoringEdit = { schemaVersion:'studio_authoring_edit.v1',designId:'repair-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[] };
  const result = applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'}); if(!result.ok)throw Error(result.message);
  edit.spatial=result.spatial;
  // Explicit historical small/low source keeps the refusal cases independent of new-house defaults.
  const historical=edit.spatial.houseAssembly!.houseForms[0];delete historical.wallHeightM;delete historical.eaveHeightM;
  const rectangle=historical.composition.primitives[0];if(rectangle.kind!=='axisAlignedRectangle')throw Error();rectangle.widthMm=6000;rectangle.depthMm=4000;
  return addWebsitePergola(edit,'p');
}
it('exposes physical Mixed span versus the same authored width and real house edge, without accepting it', () => {
  const edit = previewStudioAttachment(fixture(),{objectId:'p',houseId:'house',edge:'rear',kind:'eave',method:'soffit'});
  const row = websiteComposition(edit)[0]; expect(row.error).toBeNull();
  const value=structuredClone(row.value!);value.selection.roof.finish={...DEFAULT_ROOF_FINISH,material:'combination',ceiling:'thermopine-150'};
  const changed=changeStudioProduct(edit,value), invalid=websiteComposition(changed)[0];
  expect(invalid.error).toContain('shorter');expect(invalid.value!.rawDimensions.widthMm).toBe('6000');
  const measurements=invalid.attachment&&'measurements' in invalid.attachment?invalid.attachment.measurements:null;
  expect(measurements).not.toBeNull();expect(measurements!.requiredSpanMm).toBeGreaterThan(measurements!.availableSpanMm);
  expect(measurements!.authoredWidthMm).toBe(6000);expect(invalid.reference).toEqual(row.reference);
  expect(studioConnectionPresentation(invalid).state).toBe('Connection needs repair');
  const house=studioHouseScene(changed.site,changed.spatial)!.houses[0];
  const repaired=updateStudioHouse(changed,{...house,widthMm:'8000'});
  expect(websiteComposition(repaired)[0].error).toBeNull();
  expect(websiteComposition(edit)[0].position).toEqual(row.position);
});
it('keeps rejected support measurements, with the existing 2000–5000 range intact', () => {
  try { previewStudioAttachment(fixture(),{objectId:'p',houseId:'house',edge:'rear',kind:'wall',method:'facade'}); throw Error('Expected refusal'); }
  catch(error) { expect(error).toBeInstanceOf(StudioConnectionError); const e=error as StudioConnectionError;expect(e.message).toContain('2000–5000');expect(e.measurements!.supportDatumMm).toBeLessThan(2000);expect(e.measurements!.targetAttachmentHeightMm).toBeGreaterThan(e.measurements!.supportDatumMm!);expect(e.measurements!.requiredSpanMm).toBeGreaterThan(0); }
});
it('never presents commercial intent or alignment as an applied house connection', () => {
  const edit=fixture(),row=websiteComposition(edit)[0];
  expect(studioConnectionPresentation(row)).toMatchObject({state:'House connection planned',detail:'No house edge is connected.'});
  const value=structuredClone(row.value!);value.selection.roof.attachmentIntent='freestanding';
  expect(studioConnectionPresentation(websiteComposition(changeStudioProduct(edit,value))[0]).state).toBe('Freestanding');
  value.selection.roof.attachmentIntent='unsure';expect(studioConnectionPresentation(websiteComposition(changeStudioProduct(edit,value))[0]).state).toBe('Support undecided');
  const attached=websiteComposition(previewStudioAttachment(edit,{objectId:'p',houseId:'house',edge:'rear',kind:'eave',method:'soffit'}))[0];
  expect(studioConnectionPresentation(attached)).toMatchObject({state:'Connected to house',detail:'Soffit brackets · House · rear roof edge'});
  expect(studioConnectionPresentation(attached).height).toContain('Resolved support underside');
});

it('shows the resolved freestanding reference for omitted and explicit heights, never an invalid reference', () => {
  const edit=fixture(), value=structuredClone(websiteComposition(edit)[0].value!);
  value.selection.roof.attachmentIntent='freestanding';
  const defaultRow=websiteComposition(changeStudioProduct(edit,value))[0];
  expect(defaultRow.value!.supportDatumMm).toBeUndefined();
  expect(studioConnectionPresentation(defaultRow).height).toBe('Resolved support reference underside: 2,400 mm. This is not a post cut length.');
  value.supportDatumMm='2875';
  expect(studioConnectionPresentation(websiteComposition(changeStudioProduct(edit,value))[0]).height).toContain('2,875 mm');
  value.supportDatumMm='not a height';
  const invalid=websiteComposition(changeStudioProduct(edit,value))[0];
  expect(invalid.error).toBeTruthy();expect(invalid.value!.supportDatumMm).toBe('not a height');
  expect(studioConnectionPresentation(invalid).height).toBeNull();
});
