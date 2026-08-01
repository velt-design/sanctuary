import { describe, expect, it } from 'vitest';
import {
  PROJECT_FINDER_HOME_PATH,
  homeProjectFinderMetadata,
} from './routeContract';

describe('project finder homepage route contract', () => {
  it('keeps the prototype non-indexed and canonicalizes to the live homepage', () => {
    expect(PROJECT_FINDER_HOME_PATH).toBe('/home-project-finder');
    expect(homeProjectFinderMetadata).toMatchObject({
      alternates: { canonical: '/' },
      robots: { index: false, follow: false },
    });
  });
});
