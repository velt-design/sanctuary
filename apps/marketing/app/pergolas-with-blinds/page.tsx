import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { pergolasWithBlindsConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = { title: { absolute: 'Pergolas With Blinds Auckland | Integrated Outdoor Screens' }, description: pergolasWithBlindsConfig.description, alternates: { canonical: pergolasWithBlindsConfig.route }, openGraph: { type: 'website', url: pergolasWithBlindsConfig.route, title: 'Pergola Blinds Designed as Part of the Edge', description: 'Plan outdoor blinds around the exposed side, view, frame, controls and actual use of an Auckland pergola.', images: [{ url: pergolasWithBlindsConfig.hero.image, alt: pergolasWithBlindsConfig.hero.imageAlt }] }, twitter: { card: 'summary_large_image', title: 'Pergola Blinds Designed as Part of the Edge', description: 'A practical guide to integrated outdoor blinds for Auckland pergolas.', images: [pergolasWithBlindsConfig.hero.image] } };
export default function PergolasWithBlindsPage() { return <SeoLandingPage config={pergolasWithBlindsConfig} />; }
