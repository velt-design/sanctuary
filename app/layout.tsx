// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import '@/styles/tokens.css';
import './globals.css';
import '@/styles/header.css';
import Header from '@/components/Header';
import ProductSubHeader from '@/components/ProductSubHeader';
import SiteFooter from '@/components/SiteFooter';
import PageTransitions from '@/components/PageTransitions';
import FooterHeaderSync from '@/components/FooterHeaderSync';
import Analytics from '@/components/Analytics';
import WebVitals from '@/components/WebVitals';
import { Suspense } from 'react';
import JsonLd from '@/components/JsonLd';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.sanctuarypergolas.co.nz'),
  title: {
    default: 'Sanctuary Pergolas',
    template: '%s – Sanctuary Pergolas',
  },
  description: 'Architectural aluminium pergolas tailored to Kiwi homes. Designed on site. Built in 1–5 days. 10-year warranty.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Analytics />
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
              sameAs: [],
            },
            {
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'Sanctuary Pergolas',
              url: 'https://www.sanctuarypergolas.co.nz',
              telephone: '+64 9 634 9482',
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
              image: [
                'https://www.sanctuarypergolas.co.nz/images/hero-1.jpg',
                'https://www.sanctuarypergolas.co.nz/images/hero-2.jpg',
              ],
            },
          ]}
        />
      </head>
      <body>
        <WebVitals />
        <PageTransitions />
        <FooterHeaderSync />
        <Header />
        {/* Wrap searchParams-based subheader to satisfy CSR bailout rules */}
        <Suspense fallback={null}>
          <ProductSubHeader />
        </Suspense>
        <div className="page-viewport"><div className="page-layer">{children}</div></div>
        <SiteFooter />
      </body>
    </html>
  );
}
