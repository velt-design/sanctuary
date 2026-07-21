import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { commercialPergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = { title: { absolute: 'Commercial Pergolas Auckland | Design & Installation' }, description: commercialPergolasConfig.description, alternates: { canonical: commercialPergolasConfig.route }, openGraph: { type: 'website', url: commercialPergolasConfig.route, title: 'Commercial Pergolas Planned Around the Operation', description: 'Coordinate customers, staff, circulation, building, services and delivery in one Auckland commercial pergola brief.', images: [{ url: commercialPergolasConfig.hero.image, alt: commercialPergolasConfig.hero.imageAlt }] }, twitter: { card: 'summary_large_image', title: 'Commercial Pergolas Planned Around the Operation', description: 'A project-team guide to commercial pergola design and delivery in Auckland.', images: [commercialPergolasConfig.hero.image] } };
export default function CommercialPergolasAucklandPage() { return <SeoLandingPage config={commercialPergolasConfig} />; }
