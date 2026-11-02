import { prepareStudioCreation } from '../../apps/portal/lib/designStudio/createPreparation';
import { parseStudioAuthored, type StudioJsonObject } from '../../apps/portal/lib/designStudio/contracts';
import { parseStudioSpatialDraft } from '../../apps/portal/lib/designStudio/spatialValidation';

/** Existing synthetic saved-source fixtures intentionally start empty before
 * adding their own named objects. Preserve that historical scope independently
 * of the new-design starter. This is not a production creation option. */
export function prepareEmptyStudioFixture(input: unknown) {
  if (!input || typeof input !== 'object' || (input as {mode?:unknown}).mode !== 'blank') throw Error('Expected an explicit synthetic empty source');
  const result = prepareStudioCreation(input);
  if (!result.ok) return result;
  const authored = parseStudioAuthored(result.prepared.row.outputs.studio_authored), spatial = parseStudioSpatialDraft(result.prepared.row.outputs.drawing_object_first);
  if (!authored.ok || !spatial.ok) throw Error('Invalid synthetic source');
  authored.value.objectOptions = []; spatial.value.pergolas = [];
  result.prepared.row.outputs.studio_authored = authored.value as unknown as StudioJsonObject;
  result.prepared.row.outputs.drawing_object_first = spatial.value as unknown as StudioJsonObject;
  return result;
}
