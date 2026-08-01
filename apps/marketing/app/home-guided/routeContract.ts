import type { Metadata } from 'next';

export const HOME_GUIDED_PATH = '/home-guided';
export const HOME_GUIDED_ENABLE_PRODUCTION_ANALYTICS = false;

export const homeGuidedMetadata: Metadata = {
  title: { absolute: 'Guided Pergola Design Conversation | Sanctuary Pergolas' },
  description:
    'An experimental guided starting point for exploring a Sanctuary pergola project.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: false,
    follow: false,
  },
};
