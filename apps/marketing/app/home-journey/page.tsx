import type { Metadata } from 'next';
import { projects } from '@/data/projects';
import JourneyHomepage from './JourneyHomepage';
import { getJourneyModel } from './journey';

export const metadata: Metadata = {
  title: { absolute: 'Find Your Pergola Direction | Sanctuary Pergolas' },
  description:
    'A calm, guided starting point for finding the Sanctuary pergola direction that best fits your home, business or project.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomeJourneyPage() {
  return <JourneyHomepage model={getJourneyModel(projects)} />;
}

