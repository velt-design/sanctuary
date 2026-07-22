import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { gablePergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Gable Pergolas Auckland | Roof Form Guide' }, description: gablePergolasConfig.description, alternates: { canonical: gablePergolasConfig.route },
  openGraph: { type: 'website', url: gablePergolasConfig.route, title: 'Gable Pergolas Designed in Section, Not Chosen by Silhouette', description: 'Plan ridge height, pitch, eaves, gable ends and roof materials around the Auckland home.', images: [{ url: gablePergolasConfig.hero.image, alt: gablePergolasConfig.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: 'Gable Pergolas Designed in Section, Not Chosen by Silhouette', description: 'A practical guide to the proportions and decisions behind a gable pergola.', images: [gablePergolasConfig.hero.image] },
};
export default function GablePergolasAucklandPage() { return <SeoLandingPage config={gablePergolasConfig} />; }
