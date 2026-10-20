import type { Metadata } from 'next';
import AcrylicPergolaPage from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaPage';
export const metadata: Metadata = {
  title: 'Keep the light. Make room outside.',
  description: 'Custom acrylic pergolas for Auckland homes. Explore daylight, tints and your own starting design.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/ads/facebook/acrylic-pergolas' },
  openGraph: {
    type: 'website', title: 'Acrylic Roof Pergolas for Auckland Homes', url: '/ads/facebook/acrylic-pergolas',
    description: 'Plan an acrylic roof around daylight, shade, drainage and the home.',
    images: [{ url: '/images/project-dairy-flat-03.jpg', alt: 'Daylight through the acrylic roof of a completed Sanctuary pergola in Dairy Flat' }],
  },
};
export default function Page() { return <AcrylicPergolaPage path="/ads/facebook/acrylic-pergolas"/>; }
