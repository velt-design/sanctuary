import { Figure, TextLink } from '@/components/marketing-foundation';
import SeoLandingPage from './SeoLandingPage';
import type { SeoLandingPageConfig } from './types';
import type { GuidedJourneyContext } from '@/lib/guidedJourneyContext';
import styles from './audience-landing.module.css';

type Audience = 'professional';
type Project = { slug: string; name: string; image: string; alt: string; copy: string };

const goodHome: Project = {
  slug: 'goodhome-commercial-terrace', name: 'The Good Home Takanini',
  image: '/images/project-goodhome-05.jpg', alt: 'Twin acrylic gables and clear screens around The Good Home courtyard',
  copy: 'Two gables extend the villa-style roofline over the restaurant courtyard. Steel and aluminium framing, acrylic roofing, screens and lighting form the completed setting.',
};
const kiwiRail: Project = {
  slug: 'kiwi-rail-platform', name: 'KiwiRail Head Office',
  image: '/images/project-kiwi-rail-01.jpg', alt: 'Long acrylic canopy following a route between workplace buildings',
  copy: 'JCY Architects engaged Sanctuary to deliver their canopy design. Aluminium, acrylic roofing and integrated strip lighting follow the workplace route.',
};
const lilliput: Project = {
  slug: 'lilliput-mini-golf', name: 'Lilliput Mini Golf',
  image: '/images/project-tamaki-dr-01.jpg', alt: 'Pitched pergola beside the Lilliput Mini Golf clubhouse',
  copy: 'On this consultant-led renovation, Sanctuary supplied and installed the structure, coordinating with the project team and other trades.',
};

function ProjectStory({ project }: { project: Project }) {
  return <article className={styles.compactProject}>
    <Figure image={project.image} alt={project.alt} ratio="landscape" mobileRatio="landscape" sizes="(max-width:760px) 100vw,50vw" />
    <h3><TextLink href={`/projects/${project.slug}`}>{project.name}</TextLink></h3>
    <p>{project.copy}</p>
  </article>;
}

function ProfessionalContent() {
  return <div className={styles.content}>
    <section className={styles.package} aria-labelledby="professional-contribution"><div><p className={styles.label}>Develop the design together</p><h2 id="professional-contribution">From the first idea<br />to the resolved detail.</h2></div><div><p>Bring us into the concept, material choices, building connections and buildability. Together, we develop the pergola design and agree the route to fabrication and installation.</p><p className={styles.note}>Engineering, consent and specialist trade coordination are defined for the project. Engineering design and sign-off remain with the project engineer.</p></div></section>
    <section className={styles.detailStudy} aria-labelledby="professional-detail"><div className={styles.sectionHeading}><p className={styles.label}>Where the design comes together</p><h2 id="professional-detail">Form, connection<br />and use.</h2></div><div className={styles.pair}>
      <Figure image="/images/project-goodhome-04.jpg" objectPosition="50% 18%" alt="Acrylic roof panels, framing and integrated lighting at The Good Home" ratio="landscape" caption="The Good Home · Roof and integrated lighting" />
      <Figure image="/images/project-tamaki-dr-03.jpg" objectPosition="50% 20%" alt="Visible bolted frame connections and roof beside the building at Lilliput Mini Golf" ratio="landscape" caption="Lilliput Mini Golf · Roof frame and building interface" />
    </div><dl className={styles.detailNotes}><div><dt>Roof and materials</dt><dd>Resolve daylight, roof form and finish against the architectural intent.</dd></div><div><dt>Building and drainage</dt><dd>Develop junctions, levels, water paths and the interface with existing work.</dd></div><div><dt>Integrated details</dt><dd>Coordinate screens, lighting, services and access before fabrication.</dd></div></dl></section>
    <section id="professional-projects" className={styles.secondary} aria-labelledby="professional-work"><div className={styles.sectionHeading}><p className={styles.label}>Selected project relationships</p><h2 id="professional-work">Built with project teams.</h2></div><div className={styles.professionalWork}><ProjectStory project={kiwiRail} /><ProjectStory project={lilliput} /><ProjectStory project={goodHome} /></div><p className={styles.note}>These examples describe the roles on those completed projects. For a new project, we develop and agree the design contribution and delivery responsibilities together.</p></section>
    <section className={styles.brief} aria-labelledby="early-brief"><h2 id="early-brief">Start with what you have.</h2><p>A brief, site photographs, sketches or current drawings. Tell us what is fixed, what is open and who is involved. Files are optional.</p><TextLink href="#project-details">Discuss a project</TextLink></section>
  </div>;
}

export default function AudienceLandingPage({ config, guidedContext }: { config: SeoLandingPageConfig; audience: Audience; guidedContext?: GuidedJourneyContext | null }) {
  return <SeoLandingPage config={config} guidedContext={guidedContext} presentation={{ className: styles.page,
    hero: <header className={`${styles.hero} ${styles.professionalHero}`}>
      <div className={styles.heroCopy}><p className={styles.label}>{config.hero.eyebrow}</p><h1>{config.hero.title}</h1><p className={styles.intro}>{config.hero.intro}</p><div className={styles.actions}><TextLink href="#project-details">{config.hero.primaryCta}</TextLink><TextLink href={config.hero.secondaryHref}>{config.hero.secondaryCta}</TextLink></div></div>
      <Figure image={config.hero.image} alt={config.hero.imageAlt} objectPosition={config.hero.objectPosition} ratio="portrait" mobileRatio="standard" priority sizes="(max-width:760px) 100vw,70vw" caption="KiwiRail Head Office · Architect-led canopy" />
    </header>, content: <ProfessionalContent />,
  }} />;
}
