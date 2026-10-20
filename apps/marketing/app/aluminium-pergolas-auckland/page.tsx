import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '../../components/JsonLd';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import ChannelTrackingRegion from '../../components/journey/ChannelTrackingRegion';
import foundation from '../../components/marketing-foundation/foundation.module.css';
import { absoluteUrl } from '../../lib/seo';
import AluminiumJourney from './AluminiumJourney';
import { ALUMINIUM_ROUTE, aluminiumDescription, aluminiumFaqs, roofExamples } from './content';
import styles from './aluminium.module.css';

export const metadata: Metadata = {
  title: 'Aluminium Pergolas Auckland', description: aluminiumDescription,
  alternates: { canonical: ALUMINIUM_ROUTE },
  openGraph: { type: 'website', url: ALUMINIUM_ROUTE, title: 'Aluminium Pergolas Auckland | Sanctuary Pergolas', description: aluminiumDescription, images: [{ url: '/images/project-st-heliers-01.jpg', alt: 'Aluminium gable pergola with opal acrylic at a St Heliers home' }] },
  twitter: { card: 'summary_large_image', title: 'Aluminium Pergolas Auckland | Sanctuary Pergolas', description: aluminiumDescription, images: ['/images/project-st-heliers-01.jpg'] },
};

export default function AluminiumPergolasAucklandPage() {
  return <ChannelTrackingRegion><main className={`${foundation.marketingPage} ${styles.page}`} data-marketing-foundation-page data-seo-landing="aluminium-pergolas-auckland">
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Aluminium Pergolas Auckland', url: absoluteUrl(ALUMINIUM_ROUTE), description: aluminiumDescription, primaryImageOfPage: absoluteUrl('/images/project-st-heliers-01.jpg') },
      { '@context': 'https://schema.org', '@type': 'Service', name: 'Custom aluminium pergola design and installation in Auckland', serviceType: 'Aluminium pergola design and installation', areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(ALUMINIUM_ROUTE) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }, { '@type': 'ListItem', position: 3, name: 'Aluminium Pergolas Auckland', item: absoluteUrl(ALUMINIUM_ROUTE) }] },
    ]}/>
    <section className={styles.hero} aria-labelledby="aluminium-title">
      <div className={styles.heroCopy}><p className={styles.eyebrow}>Designed and installed in Auckland</p><h1 id="aluminium-title">Aluminium pergolas.<br/>Made to belong.</h1><p className={styles.heroIntro}>An aluminium frame. A roof chosen for the way you want to live outside.</p><div className={styles.heroActions}><a className={styles.primary} href="#project-details" data-channel-action="quote">Discuss your pergola <ArrowUpRight/></a><a className={styles.textLink} href="#roof-options">Explore roof options <ArrowUpRight/></a></div><p className={styles.heroNote}>Free Auckland site measures.</p></div>
      <figure className={styles.heroPhoto}><Image src="/images/project-st-heliers-01.jpg" alt="White aluminium gable and opal acrylic roof extending a St Heliers townhouse onto its terrace" fill preload sizes="(max-width: 800px) 100vw, 62vw"/><figcaption>St Heliers, Auckland. Aluminium frame and opal acrylic roof.</figcaption></figure>
    </section>
    <section className={styles.roofs} id="roof-options" aria-labelledby="roof-options-title"><div className={styles.sectionIntro}><h2 id="roof-options-title">Daylight, warmth, <br/>or a little of both.</h2><div><p>The roof changes how the space feels.<br/>Start with what matters to you.</p><p>Aluminium describes the frame. The roof can bring in daylight, create a timber-lined ceiling, or combine the two.</p></div></div><div className={styles.projectGrid}>{roofExamples.map(project => <article key={project.slug}><Link className={styles.projectImage} href={`/projects/${project.slug}`} aria-label={`View ${project.caption}`}><Image src={project.image} alt={project.alt} fill sizes="(max-width: 800px) 100vw, 33vw" style={{ objectPosition: project.position }}/></Link><h3><Link href={`/projects/${project.slug}`}>{project.title} <ArrowUpRight/></Link></h3><p>{project.description}</p><p className={styles.caption}>{project.caption}</p></article>)}</div><p className={styles.projectNote}>Three completed projects, each designed for its site. Furniture and landscaping are not part of the estimate below.</p></section>
    <AluminiumJourney>
      <section className={styles.considered} aria-labelledby="considered-title"><h2 id="considered-title">Considered together.</h2><p>The colour beside your joinery. The roof edge above the doors. The post beside the path. Small decisions that help the whole pergola belong.</p><Link className={styles.textLink} href="/pergolas-auckland">Explore our Auckland pergolas <ArrowUpRight/></Link></section>
    </AluminiumJourney>
    <section className={styles.questions} aria-labelledby="questions-title"><div><p className={styles.eyebrow}>A few useful answers</p><h2 id="questions-title">Before we talk.</h2><p>Frame, finish and the fit with your home.</p></div><div>{aluminiumFaqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p>{'href' in item && <Link className={styles.textLink} href={item.href}>{item.link} <ArrowUpRight/></Link>}</details>)}<p className={styles.researchLink}>Looking closely at daylight and tint? <Link href="/acrylic-roof-pergolas-auckland">Explore acrylic roof pergolas.</Link></p></div></section>
  </main></ChannelTrackingRegion>;
}
