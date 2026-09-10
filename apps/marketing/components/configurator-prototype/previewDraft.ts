import { constrainRoofFinish, parseRoofFinish, previewProjectionMax } from "./roofFinish";
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import { parseSimpleCoverInput, type SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { constrainPreviewConnection, INITIAL_INPUT } from './model';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';
import { parseBlinds } from './blindCatalog';
import { validPreviewBlinds } from './blindSelection';
import { previewBlindOpenings } from './blindSelection';
import { parseSidePanels } from './sidePanelCatalog';
import { sidePanelSupports } from './sidePanelLayout';

// Isolated representative preview; deliberately separate from the future customer intent document.
export const PREVIEW_DRAFT_KEY = 'sanctuary.configurator-preview.v1';
export type PreviewDraft = { version: 1; input: SimpleCoverInput; roof: PreviewRoofChoices };
export const DEFAULT_PREVIEW_DRAFT: PreviewDraft = { version: 1, input: INITIAL_INPUT, roof: INITIAL_ROOF };

export function parsePreviewDraft(value: unknown): PreviewDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (draft.version !== 1 || !draft.roof || typeof draft.roof !== 'object' || Array.isArray(draft.roof)) return null;
  const input = parseSimpleCoverInput(draft.input);
  const roof = draft.roof as Record<string, unknown>;
  if (!input || input.widthMm < CUSTOMER_DIMENSION_BOUNDS.lengthMm.minimum
    || input.projectionMm < CUSTOMER_DIMENSION_BOUNDS.projectionMm.minimum
    || (roof.family !== 'mono' && roof.family !== 'gable' && roof.family !== 'box')
    || (roof.orientation !== 'parallel' && roof.orientation !== 'away') || typeof roof.infills !== 'boolean') return null;
  const finish = roof.finish === undefined ? undefined : parseRoofFinish(roof.finish);
  if (finish === null) return null;
  const blinds=roof.blinds===undefined?undefined:parseBlinds(roof.blinds);
  if(blinds===null) return null;
  const panels=roof.sidePanels===undefined?undefined:parseSidePanels(roof.sidePanels);
  if(panels===null || panels?.some(p=>blinds?.some(b=>b.opening===p.opening)))return null;
  const selectedRoof: PreviewRoofChoices = { family: roof.family, orientation: roof.orientation, infills: roof.infills, ...(finish ? { finish } : {}) };
  const sizedInput = { ...input, projectionMm: Math.min(input.projectionMm, previewProjectionMax(selectedRoof)) };
  const validInput=constrainPreviewConnection(sizedInput, roof.family);
  if(blinds) selectedRoof.blinds=validPreviewBlinds(validInput,selectedRoof,blinds);
  if(panels){const openings=previewBlindOpenings(validInput,selectedRoof);selectedRoof.sidePanels=panels.filter(p=>{const o=openings.find(o=>o.id===p.opening);return o&&sidePanelSupports(o,p).length>1;});}
  return {
    version: 1,
    input: validInput,
    roof: constrainRoofFinish(selectedRoof, sizedInput),
  };
}
