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
import { absoluteUrl } from '../../lib/seo';
import { orderGuidedItemsBySlug, resolveGuidedJourneyContext, type GuidedJourneySearchParams } from '../../lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext } from '../../lib/projectFinderContinuation';
import CustomJourney from './CustomJourney';
import { CUSTOM_ROUTE, customDescription, customHero, customStories, customFaqs } from './content';
import styles from './custom.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Custom Pergolas Auckland | Bespoke Design & Installation' },
  description: customDescription,
  alternates: { canonical: CUSTOM_ROUTE },
  openGraph: { type: 'website', url: CUSTOM_ROUTE, title: 'Custom Pergolas. Designed Around Your Home. | Sanctuary Pergolas', description: customDescription, images: [{ url: customHero.image, alt: customHero.alt }] },
  twitter: { card: 'summary_large_image', title: 'Custom Pergolas Auckland | Sanctuary Pergolas', description: customDescription, images: [customHero.image] },
};

export default async function CustomPergolasAucklandPage({ searchParams }: { searchParams?: Promise<GuidedJourneySearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const guidedContext = resolveGuidedJourneyContext('bespoke', params);
  const guidedProjects = guidedContext ? orderGuidedItemsBySlug(
    projects.filter(project => guidedContext.preferredProjectSlugs.includes(project.slug)),
    guidedContext.preferredProjectSlugs,
  ) : [];
  const finderContext = guidedContext ? null : resolveProjectFinderJourneyContext('bespoke', params);
  const context = guidedContext?.enquiryContext ?? finderContext?.enquiryContext
    ?? { enquiryType: 'residential' as const, sourcePath: CUSTOM_ROUTE, sourceComponent: 'embedded_form' as const };

  return <ChannelTrackingRegion><main className={`${foundation.marketingPage} ${styles.page}`} data-marketing-foundation-page data-seo-landing="custom-pergolas-auckland">
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Custom Pergolas Auckland', url: absoluteUrl(CUSTOM_ROUTE), description: customDescription, primaryImageOfPage: absoluteUrl(customHero.image) },
      { '@context': 'https://schema.org', '@type': 'Service', name: 'Custom pergola design and installation in Auckland', serviceType: 'Bespoke pergola design and installation', areaServed: { '@type': 'City', name: 'Auckland' }, provider: { '@type': 'Organization', name: 'Sanctuary Pergolas', url: absoluteUrl('/') }, url: absoluteUrl(CUSTOM_ROUTE) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Pergola Guides', item: absoluteUrl('/pergola-guides') }, { '@type': 'ListItem', position: 3, name: 'Custom Pergolas Auckland', item: absoluteUrl(CUSTOM_ROUTE) }] },
    ]}/>
    <section className={styles.hero} aria-labelledby="custom-title">
      <div className={styles.heroOpening}><div><p className={styles.eyebrow}>Designed and installed in Auckland</p><h1 id="custom-title">Custom pergolas.<br/>Designed around your home.</h1></div><div className={styles.heroIntro}><p>A place for long lunches, a quiet morning, or more time outside. Start with how you want to live. We’ll work through the shape, light and details with you.</p><a className={styles.primary} href="#project-details" data-channel-action="quote">Talk about your space <ArrowUpRight/></a><p className={styles.small}>No drawings or finished idea needed.</p></div></div>
      <figure className={styles.heroPhoto}><div><Image src={customHero.image} alt={customHero.alt} fill preload sizes="(max-width: 800px) 100vw, (max-width: 1440px) 92vw, 1312px"/></div><figcaption>Tindalls Bay, Auckland. A roof designed around the way the home is used.</figcaption></figure>
      <div className={styles.heroFoot}><p>Free Auckland site measures.</p><a className={styles.textLink} href="#custom-projects">Explore two real projects <ArrowUpRight/></a></div>
    </section>
    <GuidedJourneyContext context={guidedContext}/>
    {guidedProjects.length > 0 && <nav className={styles.guidedProjects} aria-labelledby="guided-projects-title">
      <p className={styles.eyebrow} id="guided-projects-title">Projects for your starting point</p>
      <ol>{guidedProjects.map(project => <li key={project.slug}><Link href={`/projects/${project.slug}`}>
        <span><strong>{project.title}</strong><span>{project.blurb}</span></span><ArrowUpRight/>
      </Link></li>)}</ol>
    </nav>}
    <ProjectFinderJourneyContext context={finderContext}/>
    <section className={styles.stories} id="custom-projects" aria-labelledby="projects-title">
      <header className={styles.sectionIntro}><p className={styles.eyebrow}>Designed for the people who use them</p><h2 id="projects-title">Different homes.<br/>Their own answers.</h2><p>Two completed projects. Each began with a different brief, and a different relationship to the house.</p></header>
      {customStories.map((story, index) => <article className={styles.story} key={story.slug}>
        <figure className={styles.storyPhoto}><Link href={`/projects/${story.slug}`} aria-label={`Explore the ${story.location} project`}><Image src={story.image} alt={story.alt} fill sizes="(max-width: 800px) 100vw, (max-width: 1440px) 50vw, 700px"/></Link><figcaption>{story.caption}</figcaption></figure>
        <div className={styles.storyCopy}><p className={styles.eyebrow}>0{index + 1} / {story.location}</p><h3>{story.title}</h3><dl><div><dt>The brief</dt><dd>{story.brief}</dd></div><div><dt>The design response</dt><dd>{story.response}</dd></div><div><dt>The finished space</dt><dd>{story.result}</dd></div></dl><Link className={styles.textLink} href={`/projects/${story.slug}`}>See the full project <ArrowUpRight/></Link></div>
      </article>)}
      <p className={styles.small}>These are individual completed projects. Furniture, landscaping and other work are included only where agreed in the project scope.</p>
    </section>
    <section className={styles.detailsSection} aria-labelledby="details-title">
      <figure className={styles.detailPhoto}><div><Image src="/images/project-warkworth-outdoor-room-04.jpg" alt="Clear acrylic roof glazing beside cedar ceiling lining at Warkworth" fill sizes="(max-width: 800px) 100vw, 660px"/></div><figcaption>Warkworth. Daylight placed alongside a timber-lined ceiling.</figcaption></figure>
      <div><p className={styles.eyebrow}>The details work together</p><h2 id="details-title">Start with the home.<br/>Then draw the roof.</h2><ul className={styles.designNotes}><li><h3>Keep the light you value.</h3><p>Look at the rooms opening onto the space, then decide where a solid ceiling, acrylic or a combination makes sense.</p></li><li><h3>Make room for everyday life.</h3><p>Consider doors, paths and views before settling the post positions. The dining table and the route to the garden matter too.</p></li><li><h3>Bring the levels and edges together.</h3><p>The house roofline, deck, steps and drainage shape the design. We work through the connections with the measured site in view.</p></li></ul></div>
    </section>
    <section className={styles.process} id="custom-process" aria-labelledby="process-title"><div><p className={styles.eyebrow}>From an idea to a place you use</p><h2 id="process-title">You don’t have to<br/>figure it out first.</h2></div><ol><li><h3>Tell us what you have in mind.</h3><p>Share how you want to use the space. A few photos or existing plans are helpful, but you can start with a conversation.</p></li><li><h3>Look at the home together.</h3><p>We discuss the direction, measure the site and work through the roof, structure and details that suit it.</p></li><li><h3>Agree the design and scope.</h3><p>We confirm what is included, the project-specific price and the checks needed before moving ahead.</p></li></ol></section>
    <CustomJourney context={context}/>
    <section className={styles.questions} id="custom-pergolas-faq" aria-labelledby="questions-title"><div><p className={styles.eyebrow}>Before we talk</p><h2 id="questions-title">A few useful answers.</h2></div><div>{customFaqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p>{'href' in item && <Link className={styles.textLink} href={item.href}>{item.link} <ArrowUpRight/></Link>}</details>)}<nav className={styles.related} aria-label="Related pergola guides"><Link href="/aluminium-pergolas-auckland">Explore aluminium pergolas <ArrowUpRight/></Link><Link href="/outdoor-rooms-auckland">Plan an outdoor room <ArrowUpRight/></Link><Link href="/pergolas-auckland">Our Auckland pergolas <ArrowUpRight/></Link></nav></div></section>
  </main></ChannelTrackingRegion>;
}
