import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage, { metadata } from '../page';
import ChallengerHomepage from './ChallengerHomepage';
import { parseProjectFinderRecord } from './projectFinderModel';
import {
  PROJECT_FINDER_HOME_PATH,
  PROJECT_FINDER_HOME_VARIANT,
} from '@/lib/projectFinderContract';
import { projectFinderHomepageMetadata } from './routeContract';

vi.mock('./ChallengerHomepage', () => ({ default: () => null }));
afterEach(() => vi.unstubAllEnvs());

describe('production project finder homepage route contract', () => {
  it('renders the accepted homepage in production without a preview selector and retains restored state', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('HOMEPAGE_CHALLENGER_PREVIEW', undefined);
    const query = { project: 'commercial-professional', professional_path: 'architects-designers' };
    const page = await HomePage({ searchParams: Promise.resolve(query) });
    expect(page.type).toBe(ChallengerHomepage);
    expect(page.props.initialState).toEqual(parseProjectFinderRecord(query));
    expect(metadata).toBe(projectFinderHomepageMetadata);
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });
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
