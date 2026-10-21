import { landingControl } from '@/lib/landingExperimentControl.server';
export const revalidate = 60;
import type { Metadata } from 'next';
import AcrylicPergolaPage from './AcrylicPergolaPage';
const route = '/acrylic-roof-pergolas-auckland';
const heroImage = '/images/project-dairy-flat-03.jpg';

export const metadata: Metadata = {
  title: { absolute: 'Acrylic Roof Pergolas Auckland | Sanctuary Pergolas' },
  description: 'Compare clear, grey and opal acrylic roofing, see completed Auckland pergolas and send Sanctuary your project brief.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website', url: route, title: 'Acrylic Roof Pergolas for Auckland Homes',
    description: 'Plan an acrylic roof around daylight, shade, drainage and the home.',
    images: [{ url: heroImage, alt: 'Daylight through the acrylic roof of a completed Sanctuary pergola in Dairy Flat' }],
  },
  twitter: {
    card: 'summary_large_image', title: 'Acrylic Roof Pergolas for Auckland Homes',
    description: 'Plan an acrylic roof around daylight, shade, drainage and the home.', images: [heroImage],
  },
};

export default async function Page() { return <AcrylicPergolaPage control={await landingControl(route)}/>; }
