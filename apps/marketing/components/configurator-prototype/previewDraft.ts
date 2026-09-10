import { constrainRoofFinish, parseRoofFinish, previewProjectionMax } from "./roofFinish";
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import { parseSimpleCoverInput, type SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { constrainPreviewConnection, INITIAL_INPUT } from './model';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';
import { parseBlinds } from './blindCatalog';
import { validPreviewBlinds } from './blindSelection';
import { previewBlindOpenings } from './blindSelection';
import { parseSidePanels } from './sidePanelCatalog';
import {parseRoofBattens} from './roofBattenSelection';
import {availableRafterSpots,parseLighting} from './lightingSelection';
import {pergolaLightSites,layoutRafterLights} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
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
  if(roof.roofBattens!==undefined){const battens=parseRoofBattens(roof.roofBattens);if(!battens)return null;if(finish?.material!=='solid')selectedRoof.roofBattens=battens;}
  const sizedInput = { ...input, projectionMm: Math.min(input.projectionMm, previewProjectionMax(selectedRoof)) };
  const validInput=constrainPreviewConnection(sizedInput, roof.family);
  if(blinds) selectedRoof.blinds=validPreviewBlinds(validInput,selectedRoof,blinds);
  if(panels){const openings=previewBlindOpenings(validInput,selectedRoof);selectedRoof.sidePanels=panels.filter(p=>{const o=openings.find(o=>o.id===p.opening);return o&&sidePanelSupports(o,p).length>1;});}
  if(roof.lighting!==undefined){
    const lighting=parseLighting(roof.lighting);if(!lighting)return null;
    const g=solvePergolaPreview(validInput,selectedRoof).geometry;
    if(g){const sites=pergolaLightSites(g.assembly,g.covering);
    const pool=availableRafterSpots(sites.rafters,lighting.strips);
    const amount=lighting.rafterAmount??(lighting.rafterCount===0?'off':(['low','medium','high'] as const).reduce((best,a)=>Math.abs(layoutRafterLights(pool,a).length-lighting.rafterCount)<Math.abs(layoutRafterLights(pool,best).length-lighting.rafterCount)?a:best,'low'));
selectedRoof.lighting={...lighting,strips:lighting.strips.filter(id=>sites.strips.some(s=>s.id===id)),rafterAmount:amount,rafterCount:layoutRafterLights(pool,amount).length,cedarCount:Math.min(lighting.cedarCount,sites.cedar.length)};}
  }
  return {
    version: 1,
    input: validInput,
    roof: constrainRoofFinish(selectedRoof, sizedInput),
  };
}
