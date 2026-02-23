import type { Metadata } from 'next';
import StartExploreClient from './StartExploreClient';

export const metadata: Metadata = {
  title: 'Explore Pergola Options | Sanctuary Pergolas',
  description:
    'Explore pergola styles, roof materials, and extras. Save preferences and then book a Design Consultation.',
};

export default function StartExplorePage() {
  return <StartExploreClient />;
}
