import { landingControl } from '@/lib/landingExperimentControl.server';
export const revalidate = 60;
import type { Metadata } from 'next';
import OutdoorLivingPage from './OutdoorLivingPage';

export const metadata: Metadata = {
  title: 'Make room for life outside | Auckland pergolas',
  description: 'A pergola designed around your Auckland home. Explore completed Sanctuary projects and tell us about your outdoor space.',
  alternates: { canonical: '/auckland-outdoor-living' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Make room for life outside',
    description: 'Pergolas designed around Auckland homes. Built by Sanctuary.',
    url: '/auckland-outdoor-living',
    images: [{ url: '/images/project-riverhead-gable-01.jpg', width: 2048, height: 1534, alt: 'The completed Sanctuary pavilion in Riverhead, Auckland' }],
  },
};

export default async function Page() { return <OutdoorLivingPage path="/auckland-outdoor-living" control={await landingControl("/auckland-outdoor-living")}/>; }
