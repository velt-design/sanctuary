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
import { projects } from '../../data/projects';
import { pergolaGuideEditorialReview } from '../../data/pergolaGuides';
import { absoluteUrl } from '../../lib/seo';
import { orderGuidedItemsBySlug, resolveGuidedJourneyContext, type GuidedJourneySearchParams } from '../../lib/guidedJourneyContext';
import { buildProjectFinderProjectHref, resolveProjectFinderJourneyContext } from '../../lib/projectFinderContinuation';
import OutdoorRoomJourney from './OutdoorRoomJourney';
import { OUTDOOR_ROOM_ROUTE, outdoorRoomsDescription, outdoorRoomHero, outdoorRoomExamples, outdoorRoomFaqs } from './content';
import styles from './outdoor-rooms.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Outdoor Rooms Auckland | Design & Installation' }, description: outdoorRoomsDescription,
  alternates: { canonical: OUTDOOR_ROOM_ROUTE },
  openGraph: { type: 'website', url: OUTDOOR_ROOM_ROUTE, title: 'Outdoor Rooms. More Life Outside. | Sanctuary Pergolas', description: outdoorRoomsDescription, images: [{ url: outdoorRoomHero.image, alt: outdoorRoomHero.alt }] },
  twitter: { card: 'summary_large_image', title: 'Outdoor Rooms Auckland | Sanctuary Pergolas', description: outdoorRoomsDescription, images: [outdoorRoomHero.image] },
};

export default async function OutdoorRoomsAucklandPage({ searchParams }: { searchParams?: Promise<GuidedJourneySearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const guided = resolveGuidedJourneyContext('outdoor-room', params);
  const finder = guided ? null : resolveProjectFinderJourneyContext('outdoor-room', params);
  const context = guided?.enquiryContext ?? finder?.enquiryContext
    ?? { enquiryType: 'residential' as const, sourcePath: OUTDOOR_ROOM_ROUTE, sourceComponent: 'embedded_form' as const };
  const examples = orderGuidedItemsBySlug(outdoorRoomExamples, guided?.preferredProjectSlugs);
  const projectHref = (slug: string) => finder
    ? buildProjectFinderProjectHref(finder.direction, finder.priorities, slug) : `/projects/${slug}`;

  return <ChannelTrackingRegion><main className={`${foundation.marketingPage} ${styles.page}`} data-marketing-foundation-page data-seo-landing="outdoor-rooms-auckland">
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Outdoor Rooms Auckland', url: absoluteUrl(OUTDOOR_ROOM_ROUTE), description: outdoorRoomsDescription, primaryImageOfPage: absoluteUrl(outdoorRoomHero.image), dateModified: pergolaGuideEditorialReview.date, reviewedBy: { '@type': 'Organization', name: pergolaGuideEditorialReview.reviewer, url: absoluteUrl('/') }, isPartOf: { '@type': 'CollectionPage', name: 'Sanctuary Pergola Design Library', url: absoluteUrl('/pergola-guides') } },
      { '@context': 'https://schema.org', '@type': 'Service', name: 'Outdoor room design and installation in Auckland', serviceType: 'Outdoor room design and installation', areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(OUTDOOR_ROOM_ROUTE) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }, { '@type': 'ListItem', position: 3, name: 'Outdoor Rooms Auckland', item: absoluteUrl(OUTDOOR_ROOM_ROUTE) }] },
    ]}/>
    <section className={styles.hero} aria-labelledby="outdoor-title">
      <div className={styles.heroCopy}><p className={styles.eyebrow}>Designed and installed in Auckland</p><h1 id="outdoor-title">Outdoor rooms.<br/>More life outside.</h1><p className={styles.intro}>A place to gather, put your feet up, or stay a little longer. Plan the whole space, from the roof above to the way you move through it.</p><a className={styles.primary} href="#project-details" data-channel-action="quote">Plan your outdoor room <ArrowUpRight/></a><p className={styles.small}>Free Auckland site measures.</p></div>
      <figure className={styles.heroPhoto}><div><Image src={outdoorRoomHero.image} alt={outdoorRoomHero.alt} fill preload sizes="(max-width: 800px) 100vw, (max-width: 1440px) 52vw, 730px"/></div><figcaption>Warkworth, Auckland. Lounge, dining and garden, brought together.</figcaption></figure>
    </section>
    <section className={styles.planning} id="outdoor-room-decisions" aria-labelledby="outdoor-room-decisions-title"><div><p className={styles.eyebrow}>Begin below the roof</p><h2 id="outdoor-room-decisions-title">Room to sit.<br/>Space to move.</h2></div><div><p>Start with the table, the sofa or the poolside chairs. Leave a comfortable route from the house to the garden. Then place the roof and posts around the life underneath.</p><ul><li><strong>Layout</strong><span>Doors, furniture, steps and everyday paths.</span></li><li><strong>Light</strong><span>Where you want shade, and where daylight should stay.</span></li><li><strong>Edges</strong><span>Views to keep open, shelter and services to plan early.</span></li></ul><a className={styles.textLink} href="#outdoor-room-projects">See how real rooms work <ArrowUpRight/></a></div></section>
    <div className={styles.context}><GuidedJourneyContext context={guided}/><ProjectFinderJourneyContext context={finder}/></div>
    <section className={styles.projects} id="outdoor-room-projects" aria-labelledby="projects-title">
      <header className={styles.sectionIntro}><p className={styles.eyebrow}>Places already being lived in</p><h2 id="projects-title">A different way<br/>to use the outdoors.</h2><p>{guided ? 'Start with a room that relates to your plans, then explore the other ways these spaces work.' : 'Three completed rooms, with different ways to gather, relax and connect to the garden.'}</p></header>
      <div className={styles.projectGrid}>{examples.map((example, index) => <article key={example.slug} data-room-project={example.slug} className={index === 0 ? styles.featuredProject : styles.relatedProject}>
        <figure><Link className={styles.projectPhoto} href={projectHref(example.slug)} aria-label={`Explore ${projects.find(project => project.slug === example.slug)!.title}`}><Image src={example.image} alt={example.alt} fill sizes={index === 0 ? '(max-width: 800px) 100vw, 780px' : '(max-width: 800px) 100vw, 640px'}/></Link><figcaption>{example.caption}</figcaption></figure>
        <div className={styles.projectCopy}><p className={styles.eyebrow}>{example.use}</p><h3>{projects.find(project => project.slug === example.slug)!.title}</h3><p>{example.text}</p><p className={styles.roomDecision}>{example.decision}</p><Link className={styles.textLink} href={projectHref(example.slug)}>Explore the project <ArrowUpRight/></Link></div>
      </article>)}</div>
      <p className={styles.small}>These are individual projects. Furniture, landscaping, decks and services are included only where agreed in the scope.</p>
    </section>
    <section className={styles.edges} aria-labelledby="edges-title"><figure><div className={styles.detailPhoto}><Image src="/images/project-riverhead-gable-03.webp" alt="Timber-lined ceiling and integrated lighting at the Riverhead gable pavilion" fill sizes="(max-width: 800px) 100vw, 700px"/></div><figcaption>Riverhead. Lighting considered with the ceiling and structure.</figcaption></figure><div><p className={styles.eyebrow}>Bring the details together</p><h2 id="edges-title">Plan for the evening.<br/>And the open air.</h2><p>Lighting, heating and blinds are easier to coordinate before the structure is finalised. Talk through fixing points, wiring and access alongside the roof and ceiling.</p><p>This is still an outdoor space. Shelter depends on the site and the selected products. We’ll discuss exposed edges, drainage and operating limits before agreeing the design.</p><Link className={styles.textLink} href="/pergolas-with-blinds">Explore outdoor blinds <ArrowUpRight/></Link></div></section>
    <OutdoorRoomJourney context={context}/>
    <section className={styles.questions} id="outdoor-rooms-faq" aria-labelledby="questions-title"><div><p className={styles.eyebrow}>Planning your room</p><h2 id="questions-title">A few useful answers.</h2></div><div>{outdoorRoomFaqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p>{'href' in item && <Link className={styles.textLink} href={item.href}>{item.link} <ArrowUpRight/></Link>}</details>)}<nav className={styles.related} aria-label="Related planning decisions"><Link href="/pergola-guides">All pergola guides <ArrowUpRight/></Link><Link href="/pergolas-auckland">Our Auckland pergolas <ArrowUpRight/></Link><Link href="/custom-pergolas-auckland">A design around your home <ArrowUpRight/></Link><Link href="/aluminium-pergolas-auckland">Compare roofs and materials <ArrowUpRight/></Link></nav></div></section>
  </main></ChannelTrackingRegion>;
}
