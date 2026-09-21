import { DEFAULT_ROOF_FINISH } from '@sp/geometry';
import { buildEnquiryHref, type EnquiryContext } from '@/lib/enquiryContext';
import { defaultBlind } from '../configurator-prototype/blindCatalog';
import { blindUnavailable, previewBlindOpenings } from '../configurator-prototype/blindSelection';
import { parsePreviewDraft, type PreviewDraft } from '../configurator-prototype/previewDraft';
import { serializePreviewDesign } from '../configurator-prototype/previewShare';
import type { SharedEstimate } from '../configurator-prototype/sharedEstimate';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import { previewProjectionMax } from '../configurator-prototype/roofFinish';

export const PRODUCT_MATERIALS = [
  { value: 'acrylic', label: 'Acrylic', detail: 'Light through the whole roof.' },
  { value: 'solid', label: 'Solid + timber', detail: 'Corrugated Colorsteel with 150 mm ThermoPine lining.' },
  { value: 'combination', label: 'Mixed + timber', detail: 'A central acrylic skylight with ThermoPine-lined solid roof either side.' },
] as const;
export const PRODUCT_SIDES = [
  { value: 'open', label: 'Open sides' },
  { value: 'left', label: 'Left blind' },
  { value: 'right', label: 'Right blind' },
  { value: 'all', label: 'Front + both sides' },
] as const;
export type ProductSelection = {
  widthMm: number; projectionMm: number;
  material: typeof PRODUCT_MATERIALS[number]['value'];
  sides: typeof PRODUCT_SIDES[number]['value'];
  orientation?: 'parallel' | 'away';
};
export const INITIAL_PRODUCT_SELECTION: ProductSelection = { widthMm: 6000, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' };

export function parseProductSelection(value: unknown): ProductSelection | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as ProductSelection;
  if (![v.widthMm, v.projectionMm].every(n => Number.isInteger(n) && n >= 1500 && n % 100 === 0)
    || v.widthMm > 10000 || v.projectionMm > 6000
    || !PRODUCT_MATERIALS.some(m => m.value === v.material) || !PRODUCT_SIDES.some(s => s.value === v.sides)
    || (v.orientation !== undefined && !['parallel', 'away'].includes(v.orientation))) return null;
  return { widthMm: v.widthMm, projectionMm: v.projectionMm, material: v.material, sides: v.sides, orientation: v.orientation ?? 'parallel' };
}

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
