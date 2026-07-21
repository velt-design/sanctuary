import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import { outdoorRoomsConfig } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = { title: { absolute: 'Outdoor Rooms Auckland | Custom Design & Installation' }, description: outdoorRoomsConfig.description, alternates: { canonical: outdoorRoomsConfig.route }, openGraph: { type: 'website', url: outdoorRoomsConfig.route, title: 'Outdoor Rooms Planned Around the Life Inside Them', description: 'Coordinate roof, edges, light, services and the home around the way an Auckland outdoor room should work.', images: [{ url: outdoorRoomsConfig.hero.image, alt: outdoorRoomsConfig.hero.imageAlt }] }, twitter: { card: 'summary_large_image', title: 'Outdoor Rooms Planned Around the Life Inside Them', description: 'A practical guide to complete outdoor room design in Auckland.', images: [outdoorRoomsConfig.hero.image] } };
export default function OutdoorRoomsAucklandPage() { return <SeoLandingPage config={outdoorRoomsConfig} />; }
