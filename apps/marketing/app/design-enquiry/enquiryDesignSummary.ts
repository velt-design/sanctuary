import type { PreviewDraft } from '../../components/configurator-prototype/previewDraft';
import { roofFinishDescription } from '../../components/configurator-prototype/roofFinish';
import { describeBlinds } from '../../components/configurator-prototype/blindCatalog';
import { describeSidePanels } from '../../components/configurator-prototype/sidePanelCatalog';
import { describeLighting, hasLighting } from '../../components/configurator-prototype/lightingSelection';
import { designAttachmentDescription, designRidgeDescription } from '../../lib/designAttachmentDescription';

/** Customer-visible details use the same descriptions as the submitted design brief. */
export function enquiryDesignSummary(draft: PreviewDraft) {
  const { input, roof } = draft;
  const sides = [describeBlinds(roof.blinds), describeSidePanels(roof.sidePanels)].filter(Boolean);
  return [
    { label: 'Size', value: `${(input.widthMm / 1000).toFixed(1)} × ${(input.projectionMm / 1000).toFixed(1)} m` },
    { label: 'Roofline', value: roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter' },
    ...(roof.family === 'gable' ? [{ label: 'Direction', value: designRidgeDescription(draft) }] : []),
    { label: 'Roof & ceiling', value: roofFinishDescription(roof) },
    { label: 'House connection', value: designAttachmentDescription(draft) },
    { label: 'Sides', value: sides.join('; ') || 'Open sides' },
    ...(roof.family === 'gable' ? [{ label: 'Gable ends', value: roof.infills ? 'Acrylic infills' : 'Open gable ends' }] : []),
    { label: 'Lighting', value: hasLighting(roof.lighting) ? describeLighting(roof.lighting!) : 'None selected' },
  ];
}
