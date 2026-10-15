import { expect, it } from 'vitest';
import { parsePreviewDraft, DEFAULT_PREVIEW_DRAFT } from '../configurator-prototype/previewDraft';
import { parsePreviewDesign, serializePreviewDesign } from '../configurator-prototype/previewShare';
import { productSelectionDraft } from '../products/productSelection';
import { INITIAL_PRODUCT_SELECTION } from '../products/productSelectionValues';
import { buildCustomerBrief } from '../../lib/enquiryDesign';
import { funnelPriceState } from './FunnelEstimate';
import { clarityPageAllowed } from '../../lib/clarityTracking';
import { shouldHideMarketingHeader, shouldHideMarketingFooter } from '../marketingRouteChrome';
import { GOOGLE_FUNNEL_PATHS, googleFunnelDraftKey } from '../../lib/googleFunnel';
import { getEnquiryRouteContext } from '../../lib/enquiryContext';

it('keeps tint through parser, shared design and the actual server enquiry brief', () => {
  const draft = parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, acrylicTint: 'opal' } })!;
  expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
  expect(buildCustomerBrief('residential', draft)).toMatchObject({ design: { roof: { acrylicTint: 'opal' } }, summary: expect.stringContaining('Opal acrylic') });
  expect(parsePreviewDraft({ ...draft, roof: { ...draft.roof, acrylicTint: 'invented' } })).toBeNull();
  expect(parsePreviewDraft(DEFAULT_PREVIEW_DRAFT)).toEqual(DEFAULT_PREVIEW_DRAFT);
});
it('uses table estimates only for the complete standard configuration', () => {
  const draft = productSelectionDraft(INITIAL_PRODUCT_SELECTION, 'gable').draft;
  expect(funnelPriceState(draft, true).resume).toBe(false);
  expect(funnelPriceState({ ...draft, roof: { ...draft.roof, blinds: undefined } }, true).resume).toBe(false);
  expect(funnelPriceState({ ...draft, roof: { ...draft.roof, acrylicTint: 'opal' } }, true).resume).toBe(false);
  for (const roof of [{ ...draft.roof, infills: true }, { ...draft.roof, orientation: 'away' as const }]) {
    expect(funnelPriceState({ ...draft, roof }, true).resume).toBe(true);
  }
  expect(funnelPriceState({ ...draft, input: { ...draft.input, level: 'elevated' } }, true).resume).toBe(true);
  const retainedDefaultCeiling = { ...draft, roof: { ...draft.roof, finish: { ...draft.roof.finish!, ceiling: 'thermopine-150' as const } } };
  expect(funnelPriceState(retainedDefaultCeiling, true).resume).toBe(false);
  expect(retainedDefaultCeiling.roof.finish.ceiling).toBe('thermopine-150');
  expect(funnelPriceState({ ...retainedDefaultCeiling, roof: { ...retainedDefaultCeiling.roof, infills: true } }, true).resume).toBe(true);
  expect(funnelPriceState({ ...retainedDefaultCeiling, roof: { ...retainedDefaultCeiling.roof, finish: { ...retainedDefaultCeiling.roof.finish, ceiling: 'cedar-100' } } }, true).resume).toBe(true);
});
it('isolates exact advertising routes, residential attribution and page chrome', () => {
  for (const route of GOOGLE_FUNNEL_PATHS) {
    expect(shouldHideMarketingHeader(route)).toBe(true);
    expect(shouldHideMarketingFooter(route)).toBe(true);
    expect(clarityPageAllowed(route, 'utm_source=google')).toBe(true);
    expect(clarityPageAllowed(route, 'customer=private')).toBe(false);
    expect(getEnquiryRouteContext(route)).toMatchObject({ enquiryType: 'residential' });
  }
  expect(googleFunnelDraftKey(GOOGLE_FUNNEL_PATHS[0])).not.toBe(googleFunnelDraftKey(GOOGLE_FUNNEL_PATHS[1]));
  for (const route of ['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland', '/ads/other']) {
    expect(shouldHideMarketingHeader(route)).toBe(false);
    expect(shouldHideMarketingFooter(route)).toBe(false);
  }
});
