import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import {
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { customPergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Custom Pergolas Auckland | Bespoke Design & Installation' },
  description: customPergolasConfig.description,
  alternates: { canonical: customPergolasConfig.route },
  openGraph: {
    type: 'website', url: customPergolasConfig.route, title: 'Custom Pergolas for Auckland Homes That Need a Site-Specific Answer',
    description: 'See how use, geometry, light, structure and scope are resolved together in a bespoke Sanctuary pergola.',
    images: [{ url: customPergolasConfig.hero.image, alt: customPergolasConfig.hero.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image', title: 'Custom Pergolas for Auckland Homes That Need a Site-Specific Answer',
    description: 'A practical guide to the decisions behind a bespoke, site-specific Auckland pergola.', images: [customPergolasConfig.hero.image],
  },
};

type CustomPergolasAucklandPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function CustomPergolasAucklandPage({
  searchParams,
}: CustomPergolasAucklandPageProps) {
  const guidedContext = resolveGuidedJourneyContext(
    'bespoke',
    searchParams ? await searchParams : {},
  );
  return <SeoLandingPage config={customPergolasConfig} guidedContext={guidedContext} />;
}
