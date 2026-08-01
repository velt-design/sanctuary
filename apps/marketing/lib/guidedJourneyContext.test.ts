import { describe, expect, it } from 'vitest';
import {
  getGuidedResult,
  parseGuidedConversationState,
} from '../app/_home-guided/guidedConversationModel';
import type { GuidedResultId } from './guidedJourneyContract';
import {
  orderGuidedItemsBySlug,
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from './guidedJourneyContext';

const cases: ReadonlyArray<{
  resultId: GuidedResultId;
  params: GuidedJourneySearchParams;
  destination: string;
  focusId: string;
}> = [
  ...['daylight', 'shade', 'balanced'].map((focus) => ({
    resultId: 'residential-cover' as const,
    params: { focus },
    destination: '/pergolas-auckland',
    focusId: focus,
  })),
  ...['everyday', 'entertaining', 'poolside'].map((use) => ({
    resultId: 'outdoor-room' as const,
    params: { use },
    destination: '/outdoor-rooms-auckland',
    focusId: use,
  })),
  ...['connection', 'structure', 'coordination'].map((constraint) => ({
    resultId: 'bespoke' as const,
    params: { constraint },
    destination: '/custom-pergolas-auckland',
    focusId: constraint,
  })),
  ...['hospitality', 'workplace', 'recreation'].flatMap((sector) =>
    ['lead', 'collaborate', 'feasibility'].map((role) => ({
      resultId: 'commercial' as const,
      params: { sector, role },
      destination: '/commercial-pergolas-auckland',
      focusId: role,
    })),
  ),
  ...['concept', 'developed', 'delivery'].flatMap((stage) =>
    ['design-input', 'scope', 'delivery-coordination'].map((need) => ({
      resultId: 'professional' as const,
      params: { stage, need },
      destination: '/architects-designers-builders',
      focusId: need,
    })),
  ),
];

describe('guided destination context', () => {
  it.each(cases)(
    'resolves $resultId / $focusId and restores the completed recommendation',
    ({ resultId, params, destination, focusId }) => {
      const context = resolveGuidedJourneyContext(resultId, params);

      expect(context).toMatchObject({
        resultId,
        focusId,
        destination,
        analyticsProperties: {
          experience_variant: 'guided_design_conversation_home_v1',
          pathway_result: resultId,
          final_focus: focusId,
          destination,
          source_route: '/home-guided',
        },
        enquiryContext: {
          sourcePath: destination,
          sourceComponent: 'embedded_form',
          sourceExperience: 'guided-home-v1',
          sourcePathway: resultId,
          sourceFocus: focusId,
        },
      });
      expect(context?.preferredProjectSlugs).toHaveLength(3);

      const returnUrl = new URL(context!.returnHref, 'https://example.test');
      const restoredState = parseGuidedConversationState(returnUrl.searchParams);
      expect(getGuidedResult(restoredState)?.id).toBe(resultId);
    },
  );

  it('ignores invalid, incomplete and duplicate-value context safely', () => {
    expect(resolveGuidedJourneyContext('residential-cover', {})).toBeNull();
    expect(resolveGuidedJourneyContext('residential-cover', {
      focus: 'person@example.test',
    })).toBeNull();
    expect(resolveGuidedJourneyContext('outdoor-room', {
      use: ['everyday', 'poolside'],
    })).toBeNull();
    expect(resolveGuidedJourneyContext('commercial', {
      sector: 'hospitality',
    })).toBeNull();
    expect(resolveGuidedJourneyContext('professional', {
      stage: 'concept',
      need: 'unknown',
    })).toBeNull();
  });

  it('prioritizes governed project evidence without adding or losing items', () => {
    const items = [{ slug: 'one' }, { slug: 'two' }, { slug: 'three' }];
    expect(orderGuidedItemsBySlug(items, ['three', 'one'])).toEqual([
      { slug: 'three' },
      { slug: 'one' },
      { slug: 'two' },
    ]);
    expect(items.map(({ slug }) => slug)).toEqual(['one', 'two', 'three']);
  });
});
