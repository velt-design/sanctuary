import type { Metadata } from 'next';
import GoogleFunnelPage from '@/components/google-funnel/GoogleFunnelPage';
export const metadata: Metadata = {
  title: 'Custom pergolas, designed for your Auckland home',
  description: 'Explore a pergola designed around your Auckland home. Choose a starting design and request a tailored quote.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/ads/outdoor-living' },
};
export default function Page() { return <GoogleFunnelPage/>; }
