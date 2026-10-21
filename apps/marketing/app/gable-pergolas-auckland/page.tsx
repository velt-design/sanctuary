import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import SeoLandingPage from '../../components/seo-landing/SeoLandingPage';
import PergolaGuideNavigation from '../../components/seo-landing/PergolaGuideNavigation';
import EnquiryLink from '../../components/enquiry/EnquiryLink';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import JsonLd from '../../components/JsonLd';
import { projects } from '../../data/projects';
import { products } from '../../data/products';
import { parseEnquiryContext, type EnquiryContextSearchParams } from '../../lib/enquiryContext';
import { GABLE_ROUTE, gablePergolasConfig as config, gableExamples, gableQuestions } from './content';
import GableSection from './GableSection';
import styles from './gable.module.css';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Gable Pergolas Auckland | Roof Form Guide' },
  description: config.description, alternates: { canonical: GABLE_ROUTE },
  openGraph: { type: 'website', url: GABLE_ROUTE, title: config.hero.title, description: config.description, images: [{ url: config.hero.image, alt: config.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: config.hero.title, description: config.description, images: [config.hero.image] },
};

export default async function GablePergolasAucklandPage({ searchParams }: { searchParams?: Promise<EnquiryContextSearchParams> }) {
  const enquiryContext = {
    enquiryType: 'residential' as const, sourcePath: GABLE_ROUTE, sourceComponent: 'embedded_form' as const,
    ...parseEnquiryContext(await searchParams ?? {}, { projectSlugs: projects.map(project => project.slug), productSlugs: products.map(product => product.slug) }),
  };
  const hero = <section className={styles.hero} aria-labelledby="gable-title">
    <div className={styles.opening}>
      <div><p className={styles.eyebrow}>{config.hero.eyebrow}</p><h1 id="gable-title">Gable pergolas.<br/>{' '}Room to look up.</h1></div>
      <div><p className={styles.intro}>{config.hero.intro}</p><EnquiryLink className={styles.primary}>{config.hero.primaryCta}<ArrowUpRight/></EnquiryLink></div>
    </div>
    <figure className={styles.heroPhoto}>
      <Image src={config.hero.image} alt={config.hero.imageAlt} width={2048} height={1534} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 92vw, 1312px" preload/>
      <figcaption>Riverhead, Auckland. An open gable with timber sarking, aluminium framing and steel beams.</figcaption>
    </figure>
    <div className={styles.heroFoot}><p className={styles.small}>Free Auckland site measures. No finished design needed.</p><Link className={styles.textLink} href="#gable-projects">Explore the roof options <ArrowUpRight/></Link></div>
  </section>;
  const content = <div className={styles.content}>
    <section className={styles.formSection} aria-labelledby="gable-form-title">
      <div className={styles.formCopy}><p className={styles.eyebrow}>The shape of the space</p><h2 id="gable-form-title">More height.<br/>{' '}A different feeling.</h2><p>Two roof planes rise to a ridge. That lift can give a dining area or lounge a sense of room, while the eaves keep the edges closer to the house and garden.</p><dl><div><dt>The ridge</dt><dd>The high point shapes the space above you and the outline seen from the house.</dd></div><div><dt>The eaves</dt><dd>The lower edges need to work with doors, windows, gutters and the height you can build from.</dd></div><div><dt>Width and pitch</dt><dd>A wider roof or steeper pitch changes the rise. We consider the whole section, rather than choose a pitch in isolation.</dd></div></dl></div>
      <GableSection/>
    </section>
    <section className={styles.examples} id="gable-projects" aria-labelledby="gable-projects-title">
      <header><div><p className={styles.eyebrow}>One form, different ways to live under it</p><h2 id="gable-projects-title">What would you<br/>{' '}like overhead?</h2></div><p>Acrylic, timber-lined and combination roofs change the view from below. These are separate completed projects, each designed for its own home and brief.</p></header>
      {gableExamples.map(example => <article key={example.slug} className={styles.story}>
        <figure><Image src={example.image} alt={example.alt} width={example.width} height={example.height} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 50vw, 660px"/><figcaption>{example.caption}</figcaption></figure>
        <div><p className={styles.eyebrow}>{example.location} / {example.label}</p><h3>{example.title}</h3><p>{example.text}</p><p className={styles.small}>{example.detail}</p><Link className={styles.textLink} href={`/projects/${example.slug}`}>{example.link}<ArrowUpRight/></Link></div>
      </article>)}
      <p className={styles.small}>Furniture, landscaping, services and other work are included only where agreed in the project scope.</p>
    </section>
    <section className={styles.planning} id="gable-decisions" aria-labelledby="gable-planning-title">
      <div><p className={styles.eyebrow}>Make it belong</p><h2 id="gable-planning-title">Start at the house.<br/>{' '}Look out from there.</h2><p>The gable is one part of the design. Its connection, openings and edges decide how it sits with the home.</p><EnquiryLink className={styles.textLink}>Discuss your gable pergola<ArrowUpRight/></EnquiryLink></div>
      <ol><li><h3>Follow the roofline, or stand apart?</h3><p>Dairy Flat continues an existing roof form. Warkworth is freestanding beside the house. Supports, foundations, cladding and flashing need to be resolved for the actual site.</p></li><li><h3>Leave the end open, or infill it?</h3><p>Riverhead’s open triangle frames the garden. At Dairy Flat, clear infill sits inside that frame. An infilled end changes one edge, not the weather exposure of the whole space.</p></li><li><h3>Keep light where you need it.</h3><p>Look at the windows and rooms beside the pergola, as well as the seats below. Roof material, orientation and framing all affect the result.</p></li><li><h3>Resolve the water and structure.</h3><p>Plan gutters, discharge and house junctions together. Wind exposure, loads and support positions are project-specific. We confirm the necessary structural and approval checks for the design.</p></li></ol>
    </section>
    <aside className={styles.designer} aria-labelledby="gable-designer-title"><div><p className={styles.eyebrow}>If you want to explore first</p><h2 id="gable-designer-title">Try the standard gable options.</h2><p>Choose a size, roof and sides on our Gable product page, then take that same selection into the full 3D designer. Your saved product choices stay available. The estimate applies to the selected standard configuration, subject to site and scope confirmation.</p><p className={styles.small}>You can enquire here without using the designer.</p></div><Link className={styles.textLink} href="/products/pergolas/gable">Explore gable options and 3D<ArrowUpRight/></Link></aside>
    <section className={styles.questions} id="gable-faq" aria-labelledby="gable-faq-title"><div><p className={styles.eyebrow}>Before choosing a form</p><h2 id="gable-faq-title">A few useful answers.</h2><Link className={styles.textLink} href="/pitched-pergolas-auckland">Compare a single-slope roof<ArrowUpRight/></Link></div><div>{gableQuestions.map(item => <details key={item.question}><summary>{item.question}</summary>{item.answer.map(answer => <p key={answer}>{answer}</p>)}</details>)}</div></section>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: gableQuestions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer.join(' ') } })) }}/>
    <PergolaGuideNavigation route={GABLE_ROUTE}/>
  </div>;
  return <SeoLandingPage config={config} enquiryContext={enquiryContext} presentation={{ hero, content, className: styles.page }}/>;
}
