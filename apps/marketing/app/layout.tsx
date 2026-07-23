// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import '@/styles/tokens.css';
import './globals.css';
import '@/styles/header.css';
import Header from '@/components/Header';
import ProductSubHeader from '@/components/ProductSubHeader';
import SiteFooter from '@/components/SiteFooter';
import FooterVisibilityGate from '@/components/FooterVisibilityGate';
import FooterHeaderSync from '@/components/FooterHeaderSync';
import Analytics from '@/components/Analytics';
import WebVitals from '@/components/WebVitals';
import ScrollReset from '@/components/ScrollReset';
import { Suspense, type CSSProperties } from 'react';
import MetaPixel from '@/components/MetaPixel';
import ArchiproPixel from '@/components/ArchiproPixel';
import GoogleTagManager from '@/components/GoogleTagManager';
import JsonLd from '@/components/JsonLd';
import PortalMode from '@/components/PortalMode';
import HeaderVisibilityGate from '@/components/HeaderVisibilityGate';
import ConsentBanner from '@/components/ConsentBanner';
import RouteProgress from '@/components/RouteProgress';
import { ConsentProvider } from '@/components/ConsentProvider';
import { getGoogleRating } from '@/lib/googleReviews';
import { BRAND_ACCENT_HEX, BRAND_ACCENT_RGB_CSV } from '@sp/theme';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.sanctuarypergolas.co.nz'),
  title: {
    default: 'Sanctuary Pergolas',
    template: '%s | Sanctuary Pergolas',
  },
  description: 'Architectural aluminium pergolas designed around New Zealand homes, outdoor spaces and project-specific requirements.',
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Sanctuary Pergolas',
    description: 'Architectural aluminium pergolas tailored to Kiwi homes.',
    images: [
      {
        url: '/assets/hero-right.jpg',
        width: 1200,
        height: 630,
        alt: 'Aluminium pergola over outdoor seating area',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Move viewport to a dedicated export per Next.js guidance
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const brandCssVars = {
  '--sp-accent': BRAND_ACCENT_HEX,
  '--sp-accent-rgb': BRAND_ACCENT_RGB_CSV,
} as CSSProperties;

const socialProfileUrls = [
  'https://www.instagram.com/sanctuarypergolas/',
  'https://www.facebook.com/SanctuaryPergolas',
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const review = await getGoogleRating();

  return (
    <html lang="en" style={brandCssVars}>
      <head>
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Sanctuary Pergolas',
              url: 'https://www.sanctuarypergolas.co.nz',
              logo: 'https://www.sanctuarypergolas.co.nz/logo-sanctuary.svg',
              contactPoint: [
                {
                  '@type': 'ContactPoint',
                  contactType: 'customer service',
                  email: 'info@sanctuarypergolas.co.nz',
                  areaServed: 'NZ',
                },
              ],
              sameAs: socialProfileUrls,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'Sanctuary Pergolas',
              url: 'https://www.sanctuarypergolas.co.nz',
              telephone: '+64 22 854 5633',
              email: 'info@sanctuarypergolas.co.nz',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '71G Montgomerie Road',
                addressLocality: 'Māngere',
                addressRegion: 'Auckland',
                postalCode: '2022',
                addressCountry: 'NZ',
              },
              areaServed: ['Auckland', 'Upper North Island'],
              sameAs: socialProfileUrls,
              image: [
                'https://www.sanctuarypergolas.co.nz/images/hero-1.jpg',
                'https://www.sanctuarypergolas.co.nz/images/hero-2.jpg',
              ],
            },
          ]}
        />
      </head>
      <body>
        <ConsentProvider>
          <GoogleTagManager />
          <PortalMode />
          <WebVitals />
          <FooterHeaderSync />
          <ScrollReset />
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          <HeaderVisibilityGate>
            <Header />
          </HeaderVisibilityGate>
          {/* Wrap searchParams-based subheader to satisfy CSR bailout rules */}
          <Suspense fallback={null}>
            <ProductSubHeader />
          </Suspense>
          <div className="page-viewport"><div className="page-layer">{children}</div></div>
          <FooterVisibilityGate>
            <SiteFooter reviewRating={review.rating} reviewCount={review.count} />
          </FooterVisibilityGate>
          <ConsentBanner />
          <Analytics />
          <MetaPixel />
          <ArchiproPixel />
        </ConsentProvider>
      </body>
    </html>
  );
}
