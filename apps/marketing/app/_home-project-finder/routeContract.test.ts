import { describe, expect, it } from 'vitest';
import {
  PROJECT_FINDER_HOME_PATH,
  PROJECT_FINDER_HOME_VARIANT,
} from '@/lib/projectFinderContract';
import { projectFinderHomepageMetadata } from './routeContract';

describe('production project finder homepage route contract', () => {
  it('owns the canonical, indexable root with a release-specific variant', () => {
    expect(PROJECT_FINDER_HOME_PATH).toBe('/');
    expect(PROJECT_FINDER_HOME_VARIANT).toBe('project_finder_home_v2');
    expect(projectFinderHomepageMetadata).toMatchObject({
      alternates: { canonical: '/' },
      robots: { index: true, follow: true },
      openGraph: { url: '/' },
    });
  });
});
