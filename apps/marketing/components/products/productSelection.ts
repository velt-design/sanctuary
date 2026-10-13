import { DEFAULT_ROOF_FINISH } from '@sp/geometry';
import { buildEnquiryHref, type EnquiryContext } from '@/lib/enquiryContext';
import { defaultBlind } from '../configurator-prototype/blindCatalog';
import { blindUnavailable, previewBlindOpenings } from '../configurator-prototype/blindSelection';
import { parsePreviewDraft, type PreviewDraft } from '../configurator-prototype/previewDraft';
import { serializePreviewDesign } from '../configurator-prototype/previewShare';
import type { SharedEstimate } from '../configurator-prototype/sharedEstimate';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import { previewProjectionMax } from '../configurator-prototype/roofFinish';

import { type ProductSelection } from './productSelectionValues';
export { PRODUCT_MATERIALS, PRODUCT_SIDES, INITIAL_PRODUCT_SELECTION, parseProductSelection, type ProductSelection } from './productSelectionValues';

/** Small product choices become the same canonical draft used by the full designer. */
function productRoof(material: ProductSelection['material'], type: ProductDesignType, orientation: ProductSelection['orientation'] = 'parallel'): PreviewDraft['roof'] {
  const design = PRODUCT_DESIGNS[type];
  return { family: design.family, orientation: type === 'gable' ? orientation : design.orientation, infills: false,
    finish: { ...DEFAULT_ROOF_FINISH, material, ...(material !== 'acrylic' ? { ceiling: 'thermopine-150' as const } : {}) } };
}
export function productProjectionMax(selection: ProductSelection, type: ProductDesignType) {
  return previewProjectionMax(productRoof(selection.material, type));
}
export function productSelectionDraft(selection: ProductSelection, type: ProductDesignType = 'pitched'): { draft: PreviewDraft; issue: string | null } {
  const design = PRODUCT_DESIGNS[type];
  const input: PreviewDraft['input'] = { widthMm: selection.widthMm, projectionMm: selection.projectionMm, level: 'ground', connection: design.connection };
  const roof = productRoof(selection.material, type, selection.orientation);
  const openings = selection.sides === 'open' ? [] : previewBlindOpenings(input, roof)
    .filter(o => selection.sides === 'all' || o.side === selection.sides);
  const issue = (selection.projectionMm > productProjectionMax(selection, type) ? 'Reduce the projection for this roof material.' : null)
    || openings.map(o => blindUnavailable(o)).find(Boolean)
    || (selection.sides !== 'open' && !openings.length ? 'No suitable blind openings at this size.' : null);
  roof.blinds = issue ? [] : openings.map(o => defaultBlind(o.id));
  const draft = parsePreviewDraft({ version: 1, input, roof });
  if (!draft) throw new Error('Invalid product selection');
  return { draft, issue };
}

export function designEntryHref(destination: 'configurator' | 'enquiry', draft: PreviewDraft, context: EnquiryContext, estimate?: SharedEstimate | null) {
  const contextHref = buildEnquiryHref(context);
  const query = contextHref.split('#')[0].split('?')[1] ?? '';
  const path = destination === 'configurator' ? '/configurator-preview' : '/design-enquiry';
  return `${path}?${destination === 'configurator' ? 'open=1&' + (context.sourceComponent === 'product_cta' ? 'entry=edit&' : '') : ''}${query}#design=${serializePreviewDesign(draft)}`
    + (estimate ? `&estimate=${estimate.basis}:${estimate.amountIncGst}` : '');
}

// Only published dimensions and roof form are asserted. Remaining defaults are disclosed on the project page.
export const ST_HELIERS_START: PreviewDraft = {
  version: 1, input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'fascia' },
  roof: { family: 'gable', orientation: 'away', infills: false },
};
