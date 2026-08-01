import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import {
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { commercialPergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Commercial Pergolas Auckland | Design & Build' },
  description: commercialPergolasConfig.description,
  alternates: { canonical: commercialPergolasConfig.route },
  openGraph: {
    type: 'website',
    url: commercialPergolasConfig.route,
    title: 'You Run the Venue. We Manage the Pergola Project.',
    description:
      'One experienced Auckland team for commercial pergola design, engineering and consent coordination, project management and installation.',
    images: [{ url: commercialPergolasConfig.hero.image, alt: commercialPergolasConfig.hero.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Commercial Pergolas, Managed from Design to Build',
    description:
      'Sanctuary designs and builds commercial pergolas while coordinating the technical and trade pathway where required.',
    images: [commercialPergolasConfig.hero.image],
  },
};

type CommercialPergolasAucklandPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function CommercialPergolasAucklandPage({
  searchParams,
}: CommercialPergolasAucklandPageProps) {
  const guidedContext = resolveGuidedJourneyContext(
    'commercial',
    searchParams ? await searchParams : {},
  );
  return <SeoLandingPage config={commercialPergolasConfig} guidedContext={guidedContext} />;
}
