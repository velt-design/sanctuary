import { parseProductSelection, productSelectionDraft, productProjectionMax, designEntryHref } from '../../components/products/productSelection';
import { isProductDesignType, PRODUCT_DESIGNS } from '../../components/products/productDesigns';
import { parsePreviewDraft } from '../../components/configurator-prototype/previewDraft';
import { landingSourcePath, withLandingDesignScope } from '../../components/configurator-prototype/draftScope';
import { enquiryDesignSummary } from '../design-enquiry/enquiryDesignSummary';

/** Product defaults and design validation stay in their existing owners, on the server. */
export function prepareLandingDesign(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const selection = parseProductSelection(input.selection);
  if (typeof input.type !== 'string' || !isProductDesignType(input.type) || !selection || selection.sides !== 'open') return null;
  const prepared = productSelectionDraft(selection, input.type);
  const savedDraft = input.savedDraft ? parsePreviewDraft(input.savedDraft) : null;
  const draft = savedDraft ?? prepared.draft;
  const sourceProduct = Object.entries(PRODUCT_DESIGNS).find(([, product]) => product.family === draft.roof.family)?.[0];
  const context = { sourcePath: landingSourcePath(input.sourcePath), sourceComponent: 'product_cta' as const, sourceProduct };
  return {
    draft, issue: savedDraft ? null : prepared.issue,
    projectionMax: productProjectionMax(selection, input.type),
    restored: Boolean(savedDraft),
    summary: [...enquiryDesignSummary(draft), { label: 'Level', value: draft.input.level === 'ground' ? 'Ground level' : 'Elevated' }],
    enquiryHref: withLandingDesignScope(designEntryHref('enquiry', draft, context)),
    designerHref: withLandingDesignScope(designEntryHref('configurator', draft, context)),
  };
}

export type LandingDesign = NonNullable<ReturnType<typeof prepareLandingDesign>>;
