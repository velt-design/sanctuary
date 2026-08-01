import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import {
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { professionalCapabilityConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: {
    absolute: 'For Architects, Designers & Builders | Sanctuary Pergolas',
  },
  description: professionalCapabilityConfig.description,
  alternates: { canonical: professionalCapabilityConfig.route },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: professionalCapabilityConfig.route,
    title: 'Pergola Capability for Architects, Designers and Builders',
    description: professionalCapabilityConfig.description,
    images: [
      {
        url: professionalCapabilityConfig.hero.image,
        alt: professionalCapabilityConfig.hero.imageAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Work with Sanctuary Pergolas',
    description: professionalCapabilityConfig.description,
    images: [professionalCapabilityConfig.hero.image],
  },
};

type ArchitectsDesignersBuildersPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function ArchitectsDesignersBuildersPage({
  searchParams,
}: ArchitectsDesignersBuildersPageProps) {
  const guidedContext = resolveGuidedJourneyContext(
    'professional',
    searchParams ? await searchParams : {},
  );
  return <SeoLandingPage config={professionalCapabilityConfig} guidedContext={guidedContext} />;
}
