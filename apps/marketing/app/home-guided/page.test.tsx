import { describe, expect, it } from 'vitest';
import {
  HOME_GUIDED_ENABLE_PRODUCTION_ANALYTICS,
  HOME_GUIDED_PATH,
  homeGuidedMetadata,
} from './routeContract';

describe('guided homepage baseline route', () => {
  it('is non-indexed and canonicalizes to the live homepage', () => {
    expect(HOME_GUIDED_PATH).toBe('/home-guided');
    expect(homeGuidedMetadata).toMatchObject({
      alternates: { canonical: '/' },
      robots: { index: false, follow: false },
    });
  });

  it('does not enable the production-home analytics owner', () => {
    expect(HOME_GUIDED_ENABLE_PRODUCTION_ANALYTICS).toBe(false);
  });
});
