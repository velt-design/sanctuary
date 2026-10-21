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
import { PITCHED_ROUTE, pitchedPergolasConfig as config, pitchedQuestions } from './content';
import PitchedSection from './PitchedSection';
import styles from './pitched.module.css';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';

export const metadata: Metadata = {
  title: { absolute: 'Pitched Pergolas Auckland | Mono-Pitch Roof Guide' },
  description: config.description, alternates: { canonical: PITCHED_ROUTE },
  openGraph: { type: 'website', url: PITCHED_ROUTE, title: config.hero.title, description: config.description, images: [{ url: config.hero.image, alt: config.hero.imageAlt }] },
  twitter: { card: 'summary_large_image', title: config.hero.title, description: config.description, images: [config.hero.image] },
};

export default async function PitchedPergolasAucklandPage({ searchParams }: { searchParams?: Promise<EnquiryContextSearchParams> }) {
  const enquiryContext = {
    enquiryType: 'residential' as const, sourcePath: PITCHED_ROUTE, sourceComponent: 'embedded_form' as const,
    ...parseEnquiryContext(await searchParams ?? {}, { projectSlugs: projects.map(project => project.slug), productSlugs: products.map(product => product.slug) }),
  };
  const hero = <section className={styles.hero} aria-labelledby="pitched-title">
    <div className={styles.opening}>
      <p className={styles.eyebrow}>{config.hero.eyebrow}</p>
      <h1 id="pitched-title">Pitched pergolas.<br/>{' '}One clean roofline.</h1>
      <p className={styles.intro}>{config.hero.intro}</p>
      <EnquiryLink className={styles.primary}>{config.hero.primaryCta}<ArrowUpRight/></EnquiryLink>
      <p className={styles.measure}>Free Auckland site measures.</p>
    </div>
    <figure className={styles.heroPhoto}>
      <Image src={config.hero.image} alt={config.hero.imageAlt} width={2000} height={1500} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 56vw, 810px" preload/>
      <figcaption>White framing and acrylic roofing over a garden patio. An installed reference, not a standard package.</figcaption>
    </figure>
  </section>;
  const content = <div className={styles.content}>
    <section className={styles.section} id="pitched-section" aria-labelledby="pitched-section-title">
      <header><div><p className={styles.eyebrow}>The pitched profile</p><h2 id="pitched-section-title">One roof.<br/>{' '}A clear fall.</h2></div><p>A single plane slopes from a high edge to a low edge. The roof depth, height and fall are considered together, whether it meets your house or stands on its own.</p></header>
      <PitchedSection/>
      <div className={styles.sectionNotes}>
        <div><h3>Room at the house.</h3><p>Work around doors, windows and eaves, with a suitable connection and support.</p></div>
        <div><h3>Space at the outer edge.</h3><p>Consider clearance, roof depth and the view from where you sit.</p></div>
        <div><h3>A path for water.</h3><p>Resolve the roof fall, gutter and downpipe together for the actual site.</p></div>
      </div>
    </section>
    <section className={styles.connection} id="pitched-decisions" aria-labelledby="pitched-decisions-title">
      <figure><Image src="/images/simple-pergolas/pitched-06.webp" alt="A long dark pitched acrylic roof along the doors and windows of a dark-clad home" width={1407} height={1118} sizes="(max-width: 800px) 92vw, (max-width: 1440px) 48vw, 650px"/><figcaption>A house-attached acrylic roof. Posts, doors and the outer edge considered together.</figcaption></figure>
      <div><p className={styles.eyebrow}>A roof that belongs</p><h2 id="pitched-decisions-title">Look along the house,<br/>{' '}not just up at the roof.</h2><p>A pitched form can follow a long deck or a restrained house line. It still needs to feel comfortable from the rooms behind it and from the garden.</p><ul><li>Check which windows sit behind the cover.</li><li>Place posts around doors, walking routes and furniture.</li><li>Consider the roof from inside the adjoining rooms.</li></ul><p className={styles.small}>Acrylic, solid and combination roof zones can be considered. Orientation, roof depth and your preferred balance of light and shade guide the choice.</p><EnquiryLink className={styles.textLink}>Talk through your house connection<ArrowUpRight/></EnquiryLink></div>
    </section>
    <section className={styles.examples} id="pitched-projects" aria-labelledby="pitched-projects-title">
      <header><p className={styles.eyebrow}>Built around the home</p><h2 id="pitched-projects-title">Cover where you need it.<br/>{' '}Light where it matters.</h2></header>
      <article className={styles.story}>
        <figure><Image src="/images/project-tindalls-bay-03.jpg" alt="Timber-lined and acrylic roof zones over the dining and circulation spaces at Tindalls Bay" width={3000} height={2250} sizes="(max-width: 800px) 92vw, (max-width: 1440px) 44vw, 610px"/><figcaption>Tindalls Bay. Insulated and acrylic roof zones around an existing home.</figcaption></figure>
        <div><p className={styles.eyebrow}>Attached to the home</p><h3>Cover the patio.<br/>{' '}Keep daylight in the brief.</h3><p>At Tindalls Bay, the roof works around the house geometry. Timber sarking sits beneath insulated panels over dining; acrylic and timber battens respond to the daylight brief around the circulation and entry areas.</p><p className={styles.small}>This bespoke patio and carport is a mixed-roof project, not the standard configuration shown in the designer.</p><Link className={styles.textLink} href="/projects/tindalls-bay-pavilion">See Tindalls Bay<ArrowUpRight/></Link></div>
      </article>
    </section>
    <aside className={styles.designer} aria-labelledby="pitched-designer-title"><div><p className={styles.eyebrow}>Optional starting point</p><h2 id="pitched-designer-title">Try the standard pitched options.</h2><p>Choose a size, roof and sides on the Pitched product page, then open that same selection in the full 3D designer. Your saved choices remain available. The estimate is for the selected standard configuration, subject to site and scope confirmation.</p><p className={styles.small}>The designer does not assess your house connection or drainage. You can enquire here without using it.</p></div><Link className={styles.textLink} href="/products/pergolas/pitched">Explore pitched options and 3D<ArrowUpRight/></Link></aside>
    <section className={styles.questions} id="pitched-faq" aria-labelledby="pitched-faq-title"><div><p className={styles.eyebrow}>Before you decide</p><h2 id="pitched-faq-title">Useful questions.</h2><Link className={styles.textLink} href="/gable-pergolas-auckland">Compare a central ridge<ArrowUpRight/></Link></div><div>{pitchedQuestions.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pitchedQuestions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }}/>
    <PergolaGuideNavigation route={PITCHED_ROUTE}/>
  </div>;
  return <SeoLandingPage config={config} enquiryContext={enquiryContext} presentation={{ hero, content, className: styles.page }}/>;
}
