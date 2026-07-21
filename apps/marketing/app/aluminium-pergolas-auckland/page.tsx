import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { aluminiumPergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Aluminium Pergolas Auckland | Custom Sanctuary Design' }, description: aluminiumPergolasConfig.description,
  alternates: { canonical: aluminiumPergolasConfig.route },
  openGraph: { type: 'website', url: aluminiumPergolasConfig.route, title: 'Aluminium Pergolas Designed Around the Whole Auckland Home', description: 'Understand how frame proportion, roof integration, finish and structure shape a custom aluminium pergola.', images: [{ url: aluminiumPergolasConfig.hero.image, alt: aluminiumPergolasConfig.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: 'Aluminium Pergolas Designed Around the Whole Auckland Home', description: 'A practical guide to the frame decisions behind a custom aluminium pergola.', images: [aluminiumPergolasConfig.hero.image] },
};

export default function AluminiumPergolasAucklandPage() { return <SeoLandingPage config={aluminiumPergolasConfig} />; }
