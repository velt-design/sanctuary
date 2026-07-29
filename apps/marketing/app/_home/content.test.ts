import { describe, expect, it } from 'vitest';

import { audiencePathways } from './content';

describe('homepage audience pathways', () => {
  it('opens the commercial landing page at the top', () => {
    const commercialPathway = audiencePathways.find(
      (pathway) => pathway.enquiryType === 'commercial',
    );

    expect(commercialPathway?.href).toBe('/commercial-pergolas-auckland');
  });
});
