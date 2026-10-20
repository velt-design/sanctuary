import type { Metadata } from 'next';
import OutdoorLivingPage from '@/app/auckland-outdoor-living/OutdoorLivingPage';
export const metadata: Metadata = {
  title: 'Make room for life outside',
  description: 'Pergolas designed around your Auckland home. Explore completed projects and shape your outdoor space.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/ads/facebook/outdoor-living' },
  openGraph: {
    title: 'Make room for life outside', url: '/ads/facebook/outdoor-living',
    description: 'Pergolas designed around Auckland homes. Built by Sanctuary.',
    images: [{ url: '/images/project-riverhead-gable-01.jpg', width: 2048, height: 1534, alt: 'The completed Sanctuary pavilion in Riverhead, Auckland' }],
  },
};
export default function Page() { return <OutdoorLivingPage path="/ads/facebook/outdoor-living"/>; }
