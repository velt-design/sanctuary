import Image from 'next/image';
import Link from 'next/link';
import EnquiryLink from '../../components/enquiry/EnquiryLink';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { commercialPergolasConfig as config } from './content';
import styles from './commercial.module.css';

export function CommercialHero() {
  return <header className={styles.hero}>
    <div className={styles.heroHeading}>
      <div><p className={styles.eyebrow}>{config.hero.eyebrow}</p><h1>Commercial pergolas.<br />{' '}Built around your business.</h1></div>
      <div className={styles.opening}>
        <p>{config.hero.intro}</p>
        <EnquiryLink className={styles.primary}>Discuss your project <ArrowUpRight /></EnquiryLink>
        <Link className={styles.textLink} href="#commercial-projects">See completed work <ArrowUpRight /></Link>
      </div>
    </div>
    <figure className={styles.heroPhoto}>
      <Image src={config.hero.image} alt={config.hero.imageAlt} width={3000} height={2000} priority sizes="(max-width: 1440px) 94vw, 1312px" />
      <figcaption>The Good Home Takanini. Acrylic roofing, clear screens and a covered hospitality courtyard.</figcaption>
    </figure>
  </header>;
}

export function CommercialContent() {
  return <div className={styles.content}>
    <section id="commercial-projects" className={styles.projects} aria-labelledby="commercial-built">
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>Hospitality, built</p><h2 id="commercial-built">Part of the venue.<br />Part of the experience.</h2></header>
      <article className={styles.story}>
        <figure><Image src="/images/project-goodhome-05.jpg" alt="Twin acrylic gables and clear courtyard screens following The Good Home Takanini frontage" width={3000} height={2000} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 55vw, 720px" /></figure>
        <div><p className={styles.eyebrow}>The Good Home Takanini</p><h3>Following the<br />existing roofline.</h3><p>Two gables extend the villa-style roofline over the restaurant courtyard. Steel and aluminium framing, acrylic roofing, screens and lighting form the completed setting.</p><Link className={styles.textLink} href="/projects/goodhome-commercial-terrace">Explore The Good Home <ArrowUpRight /></Link></div>
      </article>
      <article className={`${styles.story} ${styles.cafe}`}>
        <figure><Image src="/images/project-atelier-shu-01.jpg" alt="Dark acrylic gable roof and lowered side blind beside outdoor cafe tables at Atelier Shu" width={2250} height={3000} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 43vw, 550px" /></figure>
        <div><p className={styles.eyebrow}>Atelier Shu Cafe</p><h3>A smaller space.<br />The same care.</h3><p>A dark-tint acrylic gable follows the cafe frontage, with an aluminium frame and integrated blinds around the outdoor seating.</p><p className={styles.note}>Roofing, screened edges and exposure need to work together for the particular site. A covered outdoor area still has weather limits.</p><Link className={styles.textLink} href="/projects/atelier-shu-cafe">Explore Atelier Shu <ArrowUpRight /></Link></div>
      </article>
    </section>
    <section className={styles.planning} aria-labelledby="commercial-planning">
      <div><p className={styles.eyebrow}>Start with how the site works</p><h2 id="commercial-planning">The people.<br />The building.<br />The working day.</h2><p>We bring the pergola design, installation and agreed project coordination together, so you have a clear route from the brief to the build.</p></div>
      <dl>
        <div><dt>Use and circulation</dt><dd>Seating, service routes and clear access through the space.</dd></div>
        <div><dt>Light and exposure</dt><dd>Roofing, suitable screens and drainage considered together for the site.</dd></div>
        <div><dt>The existing building</dt><dd>Rooflines, connections, levels and the engineering and approval pathway.<Link className={`${styles.textLink} ${styles.planningLink}`} href="/custom-pergolas-auckland">Explore custom pergola design <ArrowUpRight /></Link></dd></div>
        <div><dt>Working around the business</dt><dd>Opening hours, deliveries, installation access and any required shutdowns agreed in advance.</dd></div>
      </dl>
    </section>
    <section className={styles.scope} aria-labelledby="commercial-scope">
      <div><p className={styles.eyebrow}>A clear scope from the start</p><h2 id="commercial-scope">One project.<br />Agreed responsibilities.</h2></div>
      <div><p>Pergola design, structure, roofing, suitable blinds or screens, and installation. We agree the engineering, consent and connected-trade coordination your project needs.</p><p className={styles.note}>Engineering design and sign-off remain with the project engineer. Approvals and operating access are project-specific. Landscaping, furniture and unrelated building work are separately agreed.</p><EnquiryLink className={styles.textLink}>Talk through your brief <ArrowUpRight /></EnquiryLink></div>
    </section>
    <section className={styles.otherWork} aria-labelledby="commercial-other-work">
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>Beyond hospitality</p><h2 id="commercial-other-work">Workplaces and recreation.</h2></header>
      <div className={styles.pair}>
        <article><figure><Image src="/images/project-kiwi-rail-01.jpg" alt="Aluminium and acrylic canopy following a pedestrian route between workplace buildings" width={2771} height={2771} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 44vw, 628px" /></figure><h3>KiwiRail Head Office</h3><p>JCY Architects engaged Sanctuary to deliver their canopy design. Aluminium, acrylic roofing and integrated strip lighting follow the workplace route.</p><Link className={styles.textLink} href="/projects/kiwi-rail-platform">Explore the workplace canopy <ArrowUpRight /></Link></article>
        <article><figure><Image src="/images/project-tamaki-dr-01.jpg" alt="Pitched pergola above the outdoor seating at Lilliput Mini Golf" width={3000} height={2250} sizes="(max-width: 800px) 90vw, (max-width: 1440px) 44vw, 628px" /></figure><h3>Lilliput Mini Golf</h3><p>On this consultant-led renovation, Sanctuary supplied and installed the structure, coordinating with the project team and other trades.</p><Link className={styles.textLink} href="/projects/lilliput-mini-golf">Explore Lilliput Mini Golf <ArrowUpRight /></Link></article>
      </div>
    </section>
    <nav className={styles.related} aria-label="Commercial planning"><Link className={styles.textLink} href="/architects-designers-builders">Working with a project team <ArrowUpRight /></Link><Link className={styles.textLink} href="/pergola-cost-auckland">Scope and cost considerations <ArrowUpRight /></Link></nav>
  </div>;
}
