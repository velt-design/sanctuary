import type { Metadata } from 'next';
import { PROJECT_FINDER_HOME_PATH } from '@/lib/projectFinderContract';

export const projectFinderHomepageTitle =
  'Architectural Pergola Design & Build | Sanctuary Pergolas';

export const projectFinderHomepageDescription =
  'Sanctuary designs, builds and installs bespoke fixed-roof architectural pergolas for Auckland homes and selected commercial projects.';

export const projectFinderHomepageMetadata: Metadata = {
  title: { absolute: projectFinderHomepageTitle },
  description: projectFinderHomepageDescription,
  alternates: { canonical: PROJECT_FINDER_HOME_PATH },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: PROJECT_FINDER_HOME_PATH,
    title: projectFinderHomepageTitle,
    description: projectFinderHomepageDescription,
    images: [{
      url: '/images/project-warkworth-outdoor-room-02.jpg',
      alt: 'Inhabited Warkworth outdoor room beneath a bespoke fixed roof',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: projectFinderHomepageTitle,
    description: projectFinderHomepageDescription,
    images: ['/images/project-warkworth-outdoor-room-02.jpg'],
  },
};
