import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '../../components/JsonLd';
import ArrowIcon from '../../components/marketing-foundation/ArrowIcon';
import { buildAssistedEnquiryHref } from '../../lib/configuratorEntry';
import { absoluteUrl } from '../../lib/seo';
import { formTopics, guideHubItems, planningTopics, servicePaths, type GuideHubTopic } from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './guides.module.css';

const route = '/pergola-guides';
const description = 'Practical pergola guides to cost, outdoor rooms, blinds, roof choices and framing. Explore real Auckland projects and find the right starting point for your space.';
const shareImage = '/images/project-warkworth-outdoor-room-04.jpg';
export const metadata: Metadata = {
  title: { absolute: 'Pergola Design Guides | Sanctuary Pergolas' }, description,
  alternates: { canonical: route },
  openGraph: { type: 'website', url: route, title: 'Pergola guides | Sanctuary Pergolas', description, images: [{ url: shareImage, alt: 'Warkworth outdoor room with a timber-lined roof and clear acrylic zones' }] },
  twitter: { card: 'summary_large_image', title: 'Pergola guides | Sanctuary Pergolas', description, images: [shareImage] },
};

function GuideCard({ topic, compact = false, first = false }: { topic: GuideHubTopic; compact?: boolean; first?: boolean }) {
  const titleId = `guide-topic-${topic.href.slice(1)}`;
  return <article className={styles.card} data-guide-card>
    <Link href={topic.href} className={styles.cardLink} aria-labelledby={titleId} data-guide-link>
      <div className={styles.cardHeading}><h3 id={titleId}>{topic.question}</h3><ArrowIcon direction="up-right" /></div>
      <div className={styles.photo}>
        <Image src={topic.image} alt={topic.alt} fill sizes={compact ? '(max-width: 640px) 100vw, (max-width: 960px) 50vw, 420px' : '(max-width: 640px) 100vw, (max-width: 1440px) 50vw, 640px'} style={{ objectPosition: topic.position ?? '50% 50%' }} preload={first} />
      </div>
      <p className={styles.summary}>{topic.summary}</p>
    </Link>
  </article>;
}

export default function PergolaGuidesPage() {
  return <main className={`acrylic-landing ${styles.page}`} data-marketing-foundation-page data-pergola-guide-hub>
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', description, url: absoluteUrl(route), primaryImageOfPage: absoluteUrl(shareImage) },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Sanctuary pergola design guides', numberOfItems: guideHubItems.length, itemListElement: guideHubItems.map((guide, index) => ({ '@type': 'ListItem', position: index + 1, name: guide.title, url: absoluteUrl(guide.href) })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl(route) },
      ] },
    ]} />
    <div className={styles.container}>
      <header className={styles.intro}>
        <div><p className={styles.eyebrow}>Ideas for your outdoor space</p><h1>Pergola guides.</h1></div>
        <div className={styles.introCopy}><p>Start with the question on your mind. Real projects and practical advice to help you plan the space.</p><Link className={styles.textLink} href={buildAssistedEnquiryHref({ sourcePath: route, sourceComponent: 'hero' }, 'help')} data-hub-enquiry>Talk to us about your space <ArrowIcon direction="up-right" /></Link></div>
      </header>
      <section className={styles.planning} aria-labelledby="planning-title" id="plan-your-space">
        <h2 id="planning-title">What would you like to know?</h2>
        <div className={styles.planningGrid}>{planningTopics.map((topic, index) => <GuideCard key={topic.href} topic={topic} first={index === 0} />)}</div>
      </section>
      <section className={styles.forms} aria-labelledby="form-title" id="roof-and-frame">
        <header className={styles.sectionHeading}><h2 id="form-title">Choose the frame and roof shape.</h2><p>See how the structure changes the space beneath it.</p></header>
        <div className={styles.formGrid}>{formTopics.map((topic) => <GuideCard key={topic.href} topic={topic} compact />)}</div>
      </section>
      <section className={styles.services} aria-labelledby="services-title" id="design-and-build">
        <header className={styles.sectionHeading}><p className={styles.eyebrow}>Design and build services</p><h2 id="services-title">Ready to make it your own?</h2><p>Explore how we can help with your home, a particular site or a commercial space.</p></header>
        <div className={styles.serviceGrid}>{servicePaths.map((service) => <Link href={service.href} key={service.href} className={styles.serviceLink} data-service-link><h3>{service.title}<ArrowIcon direction="up-right" /></h3><p>{service.summary}</p></Link>)}</div>
        <div className={styles.contact}><p>You do not need a finished design to get in touch.</p><Link className={styles.primary} href={buildAssistedEnquiryHref({ sourcePath: route, sourceComponent: 'final_cta' }, 'help')}>Tell us about your space <ArrowIcon direction="up-right" /></Link></div>
      </section>
    </div>
  </main>;
}
