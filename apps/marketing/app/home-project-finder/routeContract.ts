import type { Metadata } from 'next';
import { PROJECT_FINDER_HOME_PATH } from '@/lib/projectFinderContract';

export { PROJECT_FINDER_HOME_PATH };

export const homeProjectFinderMetadata: Metadata = {
  title: {
    absolute: 'Project Finder Homepage Prototype | Sanctuary Pergolas',
  },
  description:
    'A project-led prototype for finding a useful Sanctuary pergola starting point.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: false,
    follow: false,
  },
};
