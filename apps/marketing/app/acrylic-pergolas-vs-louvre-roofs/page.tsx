import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { acrylicVsLouvreConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = { title: { absolute: 'Acrylic Pergolas vs Louvre Roofs | Auckland Guide' }, description: acrylicVsLouvreConfig.description, alternates: { canonical: acrylicVsLouvreConfig.route }, openGraph: { type: 'website', url: acrylicVsLouvreConfig.route, title: 'Compare Acrylic Pergolas and Louvre Roof Proposals', description: 'Compare roof behaviour, daylight, controls, evidence and complete scope without assuming a universal winner.', images: [{ url: acrylicVsLouvreConfig.hero.image, alt: acrylicVsLouvreConfig.hero.imageAlt }] }, twitter: { card: 'summary_large_image', title: 'Compare Acrylic Pergolas and Louvre Roof Proposals', description: 'A decision-led guide for comparing fixed acrylic and proposed louvre roof systems.', images: [acrylicVsLouvreConfig.hero.image] } };
export default function AcrylicPergolasVsLouvreRoofsPage() { return <SeoLandingPage config={acrylicVsLouvreConfig} />; }
