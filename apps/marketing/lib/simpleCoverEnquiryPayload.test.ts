import { describe, expect, it } from 'vitest';
import { buildSimpleCoverEnquiryPayload } from './simpleCoverEnquiryPayload';

describe('buildSimpleCoverEnquiryPayload', () => {
  it('uses the opaque reference instead of repeating priced dimensions', () => {
    expect(buildSimpleCoverEnquiryPayload({
      schemaVersion: 'simple-cover-handoff.v1',
      status: 'priced',
      input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'fascia' },
      calculationRef: 'sc1.opaque-reference',
      displayedPriceIncGst: 24600,
      configurationVersion: 4,
    })).toMatchObject({
      dimensions: { widthM: null, depthM: null, heightM: null },
      style: 'pitched',
      roofMaterials: ['acrylic'],
      calculationRef: 'sc1.opaque-reference',
      simpleCoverStatus: 'priced',
      projectDetails: { simpleCover: { status: 'priced', calculationAttached: true } },
    });
  });

  it('keeps non-priced selections useful without inventing a price reference', () => {
    expect(buildSimpleCoverEnquiryPayload({
      schemaVersion: 'simple-cover-handoff.v1',
      status: 'custom',
      input: { widthMm: 9000, projectionMm: 4000, level: 'elevated', connection: 'facade' },
      calculationRef: null,
      displayedPriceIncGst: null,
      configurationVersion: null,
    })).toMatchObject({
      dimensions: { widthM: 9, depthM: 4, heightM: null },
      calculationRef: null,
      simpleCoverStatus: 'custom',
      projectDetails: {
        simpleCover: {
          status: 'custom',
          calculationAttached: false,
          deckLevel: 'elevated',
          connection: 'facade',
        },
      },
    });
  });
});
