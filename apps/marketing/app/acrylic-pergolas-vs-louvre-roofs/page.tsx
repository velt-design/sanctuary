import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import JsonLd from '@/components/JsonLd';
import SeoLandingPage from '@/components/seo-landing/SeoLandingPage';
import PergolaGuideNavigation from '@/components/seo-landing/PergolaGuideNavigation';
import { projects } from '@/data/projects';
import { products } from '@/data/products';
import { parseEnquiryContext, type EnquiryContextSearchParams } from '@/lib/enquiryContext';
import { acrylicVsLouvreConfig as config, COMPARISON_ROUTE, roofComparison, roofQuestions } from './content';
import RoofComparisonDiagram from './RoofComparisonDiagram';
import styles from './comparison.module.css';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Acrylic Pergolas vs Louvre Roofs | Auckland Guide' },
  description: config.description,
  alternates: { canonical: COMPARISON_ROUTE },
  openGraph: { type: 'website', url: COMPARISON_ROUTE, title: config.hero.title, description: config.description, images: [{ url: config.hero.image, alt: config.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: config.hero.title, description: config.description, images: [config.hero.image] },
};

export default async function AcrylicPergolasVsLouvreRoofsPage({ searchParams }: { searchParams?: Promise<EnquiryContextSearchParams> }) {
  const enquiryContext = {
    enquiryType: 'residential' as const,
    sourcePath: COMPARISON_ROUTE,
    sourceComponent: 'embedded_form' as const,
    ...parseEnquiryContext(await searchParams ?? {}, { projectSlugs: projects.map(project => project.slug), productSlugs: products.map(product => product.slug) }),
  };
  const hero = <section className={styles.hero} aria-labelledby="roof-guide-title">
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>{config.hero.eyebrow}</p>
      <h1 id="roof-guide-title">{config.hero.title}</h1>
      <p className={styles.intro}>{config.hero.intro}</p>
    </div>
    <div className={styles.heroAction}>
      <a className={styles.primary} href="#project-details">{config.hero.primaryCta}<span aria-hidden="true"><ArrowUpRight /></span></a>
    </div>
    <figure className={styles.heroPhoto}>
      <Image src={config.hero.image} alt={config.hero.imageAlt} width={1417} height={1984} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 53vw, 700px" preload />
      <figcaption>Dairy Flat. Fixed acrylic gable with an infilled end and open garden side.</figcaption>
      <Link className={styles.textLink} href="/projects/dairy-flat-estate">Explore the Dairy Flat pergola <span aria-hidden="true"><ArrowUpRight /></span></Link>
    </figure>
  </section>;
  const content = <div className={styles.content}>
    <section className={styles.photoStory} aria-labelledby="roof-material-title">
      <div className={styles.materialCopy}>
        <p className={styles.eyebrow}>A fixed roof, designed around the light</p>
        <h2 id="roof-material-title">Choose what stays overhead.</h2>
        <p>With acrylic, the cover stays in place. The sheets, tint and framing shape the view from your table and the rooms beside it.</p>
        <p>Clear acrylic offers a view through the roof. Opal gives a different outlook, as this deck shows. Solid or combination roof zones can be planned into the design too.</p>
        <Link className={styles.textLink} href="/acrylic-roof-pergolas-auckland">Explore our acrylic roof options <span aria-hidden="true"><ArrowUpRight /></span></Link>
      </div>
      <figure className={styles.opalPhoto}>
        <Image src="/images/roof-guide-opal-deck.webp" alt="Opal acrylic sheets and white rafters above a deck overlooking a garden" width={2400} height={1800} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 48vw, 640px" />
        <figcaption>Opal acrylic over a deck. A separate Sanctuary installation.</figcaption>
      </figure>
    </section>
    <section id="roof-comparison" className={styles.comparison} aria-labelledby="comparison-title">
      <p className={styles.eyebrow}>Comparing the alternatives</p>
      <h2 id="comparison-title">Fixed acrylic or adjustable blades?</h2>
      <p>Our acrylic roofs stay in place. Louvre roofs from other suppliers let you change the blade angle. Here is what that difference means in everyday use.</p>
      <RoofComparisonDiagram />
      <table>
        <caption className={styles.srOnly}>Sanctuary fixed acrylic compared with other suppliers’ typical solid tilting-blade roofs</caption>
        <thead><tr><th scope="col">Consider</th><th scope="col">Sanctuary fixed acrylic</th><th scope="col">Other suppliers’ tilting louvres</th></tr></thead>
        <tbody>{roofComparison.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td data-roof-label="Sanctuary fixed acrylic">{row.acrylic}</td><td data-roof-label="Other suppliers’ louvres">{row.louvre}</td></tr>)}</tbody>
      </table>
    </section>
    <section className={styles.brief} aria-labelledby="roof-brief-title">
      <div><p className={styles.eyebrow}>Planning your fixed-roof pergola</p><h2 id="roof-brief-title">Start with your space.</h2><p>You do not need a finished design. These three questions make the first conversation more useful.</p><a className={styles.textLink} href="#project-details">Discuss a fixed-roof pergola <span aria-hidden="true"><ArrowUpRight /></span></a></div>
      <ol>
        <li><h3>Where do you want light and shade?</h3><p>Consider the house windows, your usual seats and low sun from the open sides.</p></li>
        <li><h3>Would you want to change the roof position?</h3><p>A fixed roof needs no opening or closing. If adjustable overhead shade is important to you, ask a louvre supplier to demonstrate the positions and controls.</p></li>
        <li><h3>What is included in each proposal?</h3><p>Compare the same footprint, structure, roof product, drainage and site work. Ask about care, parts and warranty terms for the specified products.</p></li>
      </ol>
    </section>
    <section className={styles.faq} aria-labelledby="roof-questions-title">
      <p className={styles.eyebrow}>Useful questions</p><h2 id="roof-questions-title">A few things worth asking.</h2>
      {roofQuestions.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}
    </section>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: roofQuestions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }} />
    <PergolaGuideNavigation route={COMPARISON_ROUTE} />
  </div>;
  return <SeoLandingPage config={config} enquiryContext={enquiryContext} presentation={{ hero, content, className: styles.page }} />;
}
