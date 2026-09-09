import { constrainRoofFinish, parseRoofFinish } from "./roofFinish";
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import { parseSimpleCoverInput, type SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { constrainPreviewConnection, INITIAL_INPUT } from './model';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';

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
  return {
    version: 1,
    input: constrainPreviewConnection(input, roof.family),
    roof: constrainRoofFinish({ family: roof.family, orientation: roof.orientation, infills: roof.infills, ...(finish ? { finish } : {}) }, input),
  };
}
