import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { pergolaCostConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Pergola Cost Auckland | Scope & Quote Guide' }, description: pergolaCostConfig.description, alternates: { canonical: pergolaCostConfig.route },
  openGraph: { type: 'website', url: pergolaCostConfig.route, title: 'What Really Shapes Pergola Cost in Auckland', description: 'Compare geometry, structure, roofing, site work and responsibilities before comparing a pergola total.', images: [{ url: pergolaCostConfig.hero.image, alt: pergolaCostConfig.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: 'What Really Shapes Pergola Cost in Auckland', description: 'A practical guide to the scope behind a custom pergola price.', images: [pergolaCostConfig.hero.image] },
};
export default function PergolaCostAucklandPage() { return <SeoLandingPage config={pergolaCostConfig} />; }
