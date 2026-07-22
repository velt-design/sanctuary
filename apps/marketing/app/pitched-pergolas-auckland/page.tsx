import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { pitchedPergolasConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = { title: { absolute: 'Pitched Pergolas Auckland | Mono-Pitch Roof Guide' }, description: pitchedPergolasConfig.description, alternates: { canonical: pitchedPergolasConfig.route }, openGraph: { type: 'website', url: pitchedPergolasConfig.route, title: 'Pitched Pergolas Resolved From High Edge to Low Edge', description: 'Plan roof fall, connection, daylight and drainage as one precise mono-pitched form.', images: [{ url: pitchedPergolasConfig.hero.image, alt: pitchedPergolasConfig.hero.imageAlt }] }, twitter: { card: 'summary_large_image', title: 'Pitched Pergolas Resolved From High Edge to Low Edge', description: 'A practical guide to mono-pitched pergolas in Auckland.', images: [pitchedPergolasConfig.hero.image] } };
export default function PitchedPergolasAucklandPage() { return <SeoLandingPage config={pitchedPergolasConfig} />; }
