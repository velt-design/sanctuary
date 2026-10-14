import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '@/components/JsonLd';
import { absoluteUrl } from '@/lib/seo';
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { pergolaCostConfig as config } from './content';
import CostEstimator from './CostEstimator';
import CostGuide from './CostGuide';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';
import styles from './cost.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Pergola Cost Auckland | Estimate Your Pergola' }, description: config.description, alternates: { canonical: config.route },
  openGraph: { type: 'website', url: config.route, title: 'What Will Your Pergola Cost in Auckland?', description: config.description, images: [{ url: config.hero.image, alt: config.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: 'What Will Your Pergola Cost in Auckland?', description: config.description, images: [config.hero.image] },
};

export default function PergolaCostAucklandPage() {
  return <main className={`acrylic-landing ${styles.page}`} data-marketing-foundation-page data-seo-landing="pergola-cost-auckland">
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Pergola Cost Auckland', url: absoluteUrl(config.route), description: config.description, primaryImageOfPage: absoluteUrl(config.hero.image), dateModified: '2026-10-14', isPartOf: { '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', url: absoluteUrl('/pergola-guides') } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }, { '@type': 'ListItem', position: 3, name: 'Pergola Cost Auckland', item: absoluteUrl(config.route) }] },
    ]} />
    <header className={styles.opening} id="price-with-context"><nav aria-label="Breadcrumb"><Link href="/pergola-guides">Pergola guides</Link><span aria-hidden="true">/</span><span>Pergola cost in Auckland</span></nav><div><h1>What will your<br />pergola cost?</h1><p>{config.hero.intro}<span>Adjust the options below to explore what changes.</span></p></div></header>
    <CostEstimator />
    <CostGuide />
    <section className={styles.enquiry} id="project-details" aria-label={config.form.ariaLabel}><AcrylicPergolaEnquiryForm {...config.form}
      initialEnquiryType="residential" sourceContext={{ enquiryType: 'residential', sourcePath: config.route, sourceComponent: 'embedded_form' }}
      directContact={{ intro: 'Prefer to talk?', phoneLabel: '022 854 5633', phoneHref: 'tel:+64228545633', emailLabel: 'info@sanctuarypergolas.co.nz', emailHref: 'mailto:info@sanctuarypergolas.co.nz' }}
    /></section>
  </main>;
}
