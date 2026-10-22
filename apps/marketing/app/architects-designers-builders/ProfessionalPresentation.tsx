import Image from 'next/image';
import Link from 'next/link';
import EnquiryLink from '../../components/enquiry/EnquiryLink';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { Disclosure } from '../../components/marketing-foundation/Disclosure';
import { professionalCapabilityConfig as config } from './content';
import styles from './professionals.module.css';

export function ProfessionalHero() {
  return <header className={styles.hero}>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>{config.hero.eyebrow}</p>
      <h1>{config.hero.title}</h1>
      <p className={styles.intro}>{config.hero.intro}</p>
      <EnquiryLink className={styles.primary}>{config.hero.primaryCta} <ArrowUpRight /></EnquiryLink>
      <Link className={styles.textLink} href={config.hero.secondaryHref}>{config.hero.secondaryCta} <ArrowUpRight /></Link>
    </div>
    <figure className={styles.heroPhoto}>
      <Image src={config.hero.image} alt={config.hero.imageAlt} width={3000} height={3000} priority sizes="(max-width: 800px) 100vw, (max-width: 1440px) 62vw, 850px" />
      <figcaption>KiwiRail Head Office. Architect-led canopy design by JCY Architects, delivered with Sanctuary.</figcaption>
    </figure>
  </header>;
}

export function ProfessionalContent() {
  return <div className={styles.content}>
    <section className={styles.collaboration} aria-labelledby="professional-contribution">
      <div><p className={styles.eyebrow}>Develop the design together</p><h2 id="professional-contribution">From the first idea<br />to the resolved detail.</h2></div>
      <div><p>Bring an early brief or your current drawings. We can develop the roof form, materials, building connections and buildability together, then agree the route to fabrication and installation.</p><p className={styles.note}>Tell us what is fixed, what is still open and who is involved.</p><EnquiryLink className={styles.textLink}>Send plans or a brief <ArrowUpRight /></EnquiryLink></div>
    </section>

    <section id="professional-projects" className={styles.projects} aria-labelledby="professional-work">
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>Selected project relationships</p><h2 id="professional-work">Different projects.<br />A considered contribution.</h2></header>
      <article className={styles.story}>
        <figure><Image src="/images/project-kiwi-rail-01.jpg" alt="The acrylic canopy following a pedestrian route between buildings at KiwiRail head office" width={2771} height={2771} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 50vw, 720px" /></figure>
        <div><p className={styles.eyebrow}>KiwiRail Head Office / Architect-led</p><h3>Following the<br />architectural intent.</h3><p>JCY Architects engaged Sanctuary to deliver their canopy design. Aluminium, acrylic roofing and integrated strip lighting follow the workplace route.</p><p className={styles.note}>The building connection and the long, clear roofline are part of the same architectural idea.</p><Link className={styles.textLink} href="/projects/kiwi-rail-platform">Explore KiwiRail Head Office <ArrowUpRight /></Link></div>
      </article>
      <article className={`${styles.story} ${styles.reverse}`}>
        <figure><Image src="/images/project-tamaki-dr-02.jpg" alt="The pitched acrylic roof and visible frame above occupied seating at Lilliput Mini Golf" width={3000} height={2250} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 50vw, 720px" /></figure>
        <div><p className={styles.eyebrow}>Lilliput Mini Golf / Consultant-led renovation</p><h3>One structure.<br />A wider project team.</h3><p>Working alongside the client’s architect and engineer, we refined the pitched frame around the existing foundations, services and clubhouse.</p><p>Sanctuary’s role on this project focused on supplying and installing the structure, coordinating with the other trades completing the venue renovation.</p><Link className={styles.textLink} href="/projects/lilliput-mini-golf">Explore Lilliput Mini Golf <ArrowUpRight /></Link></div>
      </article>
      <article className={styles.story}>
        <figure><Image src="/images/project-goodhome-05.jpg" alt="Twin gables, acrylic roofing and clear screens extending The Good Home Takanini roofline" width={3000} height={2000} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 50vw, 720px" /></figure>
        <div><p className={styles.eyebrow}>The Good Home Takanini / Integrated courtyard</p><h3>Roof, edges<br />and use, together.</h3><p>Two gables extend the villa-style roofline over the restaurant courtyard. Steel and aluminium framing, acrylic roofing, screens and lighting form the completed setting.</p><p className={styles.note}>A built example of the roof and surrounding details working as one space.</p><Link className={styles.textLink} href="/projects/goodhome-commercial-terrace">Explore The Good Home <ArrowUpRight /></Link></div>
      </article>
      <p className={styles.projectNote}>These are the roles and details of completed projects. For your project, we agree the design contribution and delivery responsibilities together.</p>
    </section>

    <section className={styles.responsibilities} aria-labelledby="professional-responsibilities">
      <div><p className={styles.eyebrow}>Resolve the interfaces early</p><h2 id="professional-responsibilities">Clear scope.<br />Connected details.</h2><p>Roofing, the existing building and the surrounding work need to be considered together.</p><p className={styles.note}>Engineering design and sign-off remain with the project engineer.</p></div>
      <div className={styles.disclosures}>
        <Disclosure summary="Roof form, materials and building connections"><p>Resolve daylight, roof form and finish against the architectural intent. Develop junctions, levels, drainage and the interface with existing work.</p></Disclosure>
        <Disclosure summary="Screens, lighting and connected trades"><p>Coordinate screens, lighting, services and installation access before fabrication. Agree which parts sit within Sanctuary’s scope and which remain with the wider project team.</p></Disclosure>
        <Disclosure summary="Engineering, consent and responsibilities"><p>Engineering, consent and specialist trade coordination are defined for the project. We agree the design contribution, documentation and delivery responsibilities with your team.</p></Disclosure>
      </div>
    </section>
  </div>;
}
