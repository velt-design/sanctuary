import { describe, expect, it } from 'vitest';
import { parseSimpleCoverHandoff, type SimpleCoverHandoff } from './simpleCoverHandoff';

const pricedHandoff: SimpleCoverHandoff = {
  schemaVersion: 'simple-cover-handoff.v1',
  status: 'priced',
  input: {
    widthMm: 6_000,
    projectionMm: 3_000,
    level: 'ground',
    connection: 'soffit',
  },
  calculationRef: 'v1.opaque-calculation-reference',
  displayedPriceIncGst: 28_000,
  configurationVersion: 7,
};

describe('Simple cover browser handoff', () => {
  it('accepts the complete closed priced contract', () => {
    expect(parseSimpleCoverHandoff(pricedHandoff)).toEqual(pricedHandoff);
  });

  it('rejects a priced handoff without its server reference', () => {
    expect(parseSimpleCoverHandoff({
      ...pricedHandoff,
      calculationRef: null,
    })).toBeNull();
  });

  it('accepts non-priced selections only without price provenance', () => {
    expect(parseSimpleCoverHandoff({
      ...pricedHandoff,
      status: 'custom',
      calculationRef: null,
      displayedPriceIncGst: null,
      configurationVersion: null,
    })).toMatchObject({ status: 'custom' });
    expect(parseSimpleCoverHandoff({
      ...pricedHandoff,
      status: 'custom',
    })).toBeNull();
  });

  it('rejects out-of-range or unstepped dimensions', () => {
    expect(parseSimpleCoverHandoff({
      ...pricedHandoff,
      input: { ...pricedHandoff.input, widthMm: 6_050 },
    })).toBeNull();
  });
});
