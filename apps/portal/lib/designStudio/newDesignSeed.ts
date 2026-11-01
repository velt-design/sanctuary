import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '../drawings/state/objectFirstWorkbenchModel';
import { newStudioWebsiteDesign } from './websiteDesignContract';

/** Creation-only default. Never hydrate, normalize or replace an existing design. */
export function newStudioBaseSeed() {
  const spatial = structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT), id = 'initial-pergola';
  const design = newStudioWebsiteDesign(id);
  design.selection.roof.attachmentIntent = 'freestanding';
  spatial.pergolas.push({ id, label: 'Pergola 1', family: 'mono', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: null,
    position: { originXMm: '0', originYMm: '0', rotationDeg: '0' } });
  return { spatial, objectOptions: [{ objectId: id, options: { validation: 'preserved_unvalidated' as const, values: { websiteDesign: design } } }] };
}
