import type { Metadata } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '../../components/JsonLd';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import ChannelTrackingRegion from '../../components/journey/ChannelTrackingRegion';
import GuidedJourneyContext from '../../components/guided-journey/GuidedJourneyContext';
import ProjectFinderJourneyContext from '../../components/project-finder/ProjectFinderJourneyContext';
import foundation from '../../components/marketing-foundation/foundation.module.css';
import { withLandingDesignScope } from '../../components/configurator-prototype/draftScope';
import { pergolaGuideEditorialReview } from '../../data/pergolaGuides';
import { absoluteUrl } from '../../lib/seo';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import type { EnquiryContextSearchParams } from '../../lib/enquiryContext';
import { buildProjectFinderProjectHref } from '../../lib/projectFinderContinuation';
import { BLINDS_ROUTE, blindsDescription, blindsHero, blindExamples, blindsFaqs } from './content';
import { resolveBlindsContext } from './blindsContext';
import BlindsJourney from './BlindsJourney';
import BlindStateGallery from './BlindStateGallery';
import styles from './blinds.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Pergolas With Blinds Auckland | Integrated Outdoor Screens' }, description: blindsDescription,
  alternates: { canonical: BLINDS_ROUTE },
  openGraph: { type: 'website', url: BLINDS_ROUTE, title: 'Pergolas With Blinds | Sanctuary Pergolas', description: blindsDescription, images: [{ url: blindsHero.image, alt: blindsHero.alt }] },
  twitter: { card: 'summary_large_image', title: 'Pergolas With Blinds Auckland | Sanctuary Pergolas', description: blindsDescription, images: [blindsHero.image] },
};

export default async function PergolasWithBlindsPage({ searchParams }: { searchParams?: Promise<EnquiryContextSearchParams> }) {
  const { context, guided, finder, sourceProject } = resolveBlindsContext(searchParams ? await searchParams : {});
  const projectHref = (slug: string) => finder ? buildProjectFinderProjectHref(finder.direction, finder.priorities, slug) : `/projects/${slug}`;
  const designerHref = withLandingDesignScope(buildConfiguratorEnquiryHref(context));
  return <ChannelTrackingRegion><main className={`${foundation.marketingPage} ${styles.page}`} data-marketing-foundation-page data-seo-landing="pergolas-with-blinds">
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Pergolas With Blinds Auckland', url: absoluteUrl(BLINDS_ROUTE), description: blindsDescription, primaryImageOfPage: absoluteUrl(blindsHero.image), dateModified: pergolaGuideEditorialReview.date, reviewedBy: { '@type': 'Organization', name: pergolaGuideEditorialReview.reviewer, url: absoluteUrl('/') }, isPartOf: { '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', url: absoluteUrl('/pergola-guides') } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }, { '@type': 'ListItem', position: 3, name: 'Pergolas With Blinds', item: absoluteUrl(BLINDS_ROUTE) }] },
    ]}/>
    <section className={styles.hero} aria-labelledby="blinds-title">
      <div className={styles.heroHeading}><p className={styles.eyebrow}>Designed and installed in Auckland</p><h1 id="blinds-title">Pergolas with blinds.</h1></div>
      <a className={`${styles.primary} ${styles.heroAction}`} href="#project-details" data-channel-action="quote">Discuss your pergola <ArrowUpRight/></a>
      <figure className={styles.heroFigure}><div className={styles.heroPhoto}><Image src={blindsHero.image} alt={blindsHero.alt} fill preload sizes="(max-width: 1440px) 100vw, 1312px"/></div><figcaption>A lowered mesh blind beside an open coastal outlook. An actual Sanctuary installation.</figcaption></figure>
      <p className={styles.heroIntro}>Open to the view. Screened where it matters. Plan outdoor blinds with your new pergola.</p>
      <p className={`${styles.small} ${styles.heroMeasure}`}>Free Auckland site measures.</p>
    </section>
    <section className={styles.start} id="blind-decisions" aria-labelledby="start-title"><div><p className={styles.eyebrow}>One opening. Two ways to use it.</p><h2 id="start-title">Open it up.<br/> Lower a screen.</h2><p>See the change at the right-hand opening. With the blind raised, the trees are in full view. Lowered, the mesh filters the outlook.</p><p>Start with the side where low sun or privacy matters to you. Every side does not need to close.</p><a className={styles.textLink} href="#blind-materials">Compare mesh and clear PVC <ArrowUpRight/></a></div><BlindStateGallery/></section>
    <div className={styles.context}><GuidedJourneyContext context={guided}/><ProjectFinderJourneyContext context={finder}/>{sourceProject && <p className={styles.reference}>Your project reference: <Link href={projectHref(sourceProject.slug)}>{sourceProject.title}</Link>. We’ll keep it with your enquiry.</p>}</div>
    <BlindsJourney context={context} sourceProjectLabel={sourceProject?.title}/>
    <section className={styles.materials} id="blind-materials" aria-labelledby="materials-title"><header className={styles.sectionHeading}><p className={styles.eyebrow}>Mesh or clear PVC</p><h2 id="materials-title">A different view<br/> through each material.</h2></header><div className={styles.materialGrid}>{blindExamples.map(example => <article key={example.material}><figure><div className={styles.materialPhoto}><Image src={example.image} alt={example.alt} width={example.width} height={example.height} sizes="(max-width: 800px) 100vw, 630px"/></div><figcaption>{example.caption}</figcaption></figure><p className={styles.eyebrow}>{example.material}</p><h3>{example.heading}</h3><p>{example.text}</p></article>)}</div><p className={styles.materialNote}>Privacy and shelter depend on the selected fabric, lighting, opening and site. Blinds do not turn an outdoor pergola into a sealed indoor room.</p></section>
    <section className={styles.integration} aria-labelledby="integration-title"><figure className={styles.detailPhoto}><Image src="/images/blind-roller-post-detail.webp" alt="Two exposed blind rollers and their side guides meeting at a shared white post" width={960} height={1280} sizes="(max-width: 800px) 100vw, 450px"/><figcaption>Rollers and guides meeting at a shared post in this installation. Details vary by system.</figcaption></figure><div><p className={styles.eyebrow}>Plan the small details early</p><h2 id="integration-title">Where the blind<br/> meets the frame.</h2><p>Roller or headbox, side guides, bottom rail and clearances. With a new pergola, these can be planned together. An existing structure needs to be checked first.</p><ol><li><span>01</span><div><h3>The opening</h3><p>Check fixing points and the ground below. Leave room for doors, furniture and people to pass.</p></div></li><li><span>02</span><div><h3>Everyday operation</h3><p>Manual or motorised depends on the system and material. Plan any power and service access early.</p></div></li><li><span>03</span><div><h3>The conditions</h3><p>Review exposure and follow the exact product’s guidance for wind, cleaning and maintenance.</p></div></li></ol><Link className={styles.textLink} href="/products/screens-walls/drop-down-blinds">Explore the product details <ArrowUpRight/></Link></div></section>
    <aside className={styles.designer} aria-labelledby="designer-title"><div><p className={styles.eyebrow}>If you want to explore first</p><h2 id="designer-title">Try a standard shape in 3D.</h2><p>Use Sides &amp; lighting to explore standard side-screen layouts. The illustration and estimate are a starting point, not a fabric comparison, bespoke blind specification or retrofit quote. Your chosen design can come back with your enquiry.</p></div><a className={styles.secondary} href={designerHref} data-channel-action="design_start">Open the 3D designer <ArrowUpRight/></a></aside>
    <section className={styles.questions} id="blinds-faq" aria-labelledby="questions-title"><div><p className={styles.eyebrow}>Before you begin</p><h2 id="questions-title">A few useful answers.</h2></div><div>{blindsFaqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p>{'href' in item && <Link className={styles.textLink} href={item.href}>{item.link} <ArrowUpRight/></Link>}</details>)}<nav className={styles.related} aria-label="Related planning decisions"><Link href="/outdoor-rooms-auckland">Plan the complete outdoor room <ArrowUpRight/></Link><Link href="/pergola-guides">Explore all pergola guides <ArrowUpRight/></Link><Link href="/products/screens-walls/slat-screens">Consider a fixed slat screen <ArrowUpRight/></Link></nav></div></section>
  </main></ChannelTrackingRegion>;
}
