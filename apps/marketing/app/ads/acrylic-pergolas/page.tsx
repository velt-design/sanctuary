import type { Metadata } from 'next';
import GoogleFunnelPage from '@/components/google-funnel/GoogleFunnelPage';
export const metadata: Metadata = {
  title: 'Cover the space without losing light',
  description: 'An acrylic pergola designed around your Auckland home. Explore shapes, tints and an initial installed estimate, then request a tailored quote.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/ads/acrylic-pergolas' },
};
export default function Page() { return <GoogleFunnelPage acrylic/>; }
