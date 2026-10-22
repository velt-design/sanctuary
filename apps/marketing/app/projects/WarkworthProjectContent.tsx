import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Project } from '../../data/projects';
import { projectImageCaptions } from '../../data/projectImageCaptions';
import { Button, Eyebrow, Figure, Heading, TextLink } from '../../components/marketing-foundation/Primitives';
import { Disclosure } from '../../components/marketing-foundation/Disclosure';
import { ResponsiveGallery } from '../../components/marketing-foundation/ResponsiveGallery';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { EditorialFacts, MeasurementGroups } from '../../components/marketing-foundation/editorial/EditorialFacts';
import { getProjectFacts, getProjectTechnicalSections } from './projectPresentation';
import styles from './warkworth.module.css';

type Props = { project: Project; enquiryHref: string; relatedProjects: Project[]; projectHref: (slug: string) => string; nextProjectNavigation?: ReactNode };

export default function WarkworthProjectContent({ project, enquiryHref, relatedProjects, projectHref, nextProjectNavigation }: Props) {
  const hero = project.gallery[0];
  const decisions = [
    { title: 'A room beside the house.', image: project.heroImage, caption: 'A freestanding gable', text: 'The aluminium and steel frame stands independently of the house. The gable gives the room height and a clear centre, with the new deck and fireplace planned together.' },
    { title: 'Cedar overhead. Daylight through.', image: project.gallery[2], caption: 'Cedar lining and clear acrylic', text: 'Solid COLORSTEEL roofing and cedar lining sit alongside clear acrylic zones through the roof and gable ends. Shelter and daylight are part of the same room.' },
    { title: 'More than a roof.', image: project.gallery[5], caption: 'The deck and side entry', text: 'A new deck, fireplace and lighting complete the outdoor living space. Pendant and recessed lights were installed by a registered electrician.' },
  ];
  const usedImages = new Set([hero.src, ...decisions.map(decision => decision.image.src)]);
  const gallery = project.gallery.filter(image => !usedImages.has(image.src));
  const facts = getProjectFacts(project).filter(fact => ['Dimensions', 'Covered area', 'Roof pitch', 'Completed'].includes(fact.label));
  return (
    <article className={`${styles.page} project-case-study`} data-project-case-study={project.slug} aria-labelledby="project-case-study-title">
      <header className={styles.opening}>
        <div><Eyebrow>Built work / {project.location}</Eyebrow><h1 id="project-case-study-title">{project.title}</h1></div>
        <div className={styles.openingCopy}><p>{project.blurb}</p><Button href={enquiryHref}>Discuss a similar project <ArrowUpRight /></Button></div>
      </header>
      <div className={`${styles.hero} project-case-study__hero`}><Figure image={hero.src} alt={hero.alt} objectPosition="50% 55%" ratio="wide" mobileRatio="standard" priority sizes="(max-width: 1400px) 100vw, 1320px" /></div>
      <section className={styles.brief} id="project-story" aria-labelledby="warkworth-brief-title">
        <div><Eyebrow>The brief</Eyebrow><Heading id="warkworth-brief-title">Sheltered. Still connected<br />to the garden.</Heading></div><p>{project.description[0]}</p>
      </section>
      <section aria-label="Design decisions" className={styles.decisions}>
        {decisions.map((decision, index) => <div className={styles.decision} key={decision.title} data-project-decision>
          <Figure image={decision.image.src} alt={decision.image.alt} objectPosition={decision.image.objectPosition} ratio={index === 1 ? 'standard' : 'portrait'} mobileRatio="standard" caption={decision.caption} sizes="(max-width: 760px) 100vw, 760px" />
          <div className={styles.decisionCopy}><Eyebrow>0{index + 1} / Design decisions</Eyebrow><Heading>{decision.title}</Heading><p>{decision.text}</p></div>
        </div>)}
      </section>
      <section className={styles.details} id="project-details" aria-labelledby="warkworth-details-title">
        <div><Eyebrow>The completed project</Eyebrow><Heading id="warkworth-details-title">The details.</Heading><p>Freestanding gable. Aluminium and steel frame. Completed in November 2025.</p><TextLink href="/gable-pergolas-auckland">Explore gable pergolas</TextLink></div>
        <div><EditorialFacts className="project-case-study__fact-list" items={facts.map(fact => fact.label === 'Dimensions' ? { ...fact, value: <MeasurementGroups value={fact.value} /> } : fact)} />
          <Disclosure summary="Materials, finishes and project scope" bodyClassName={styles.technical}>{getProjectTechnicalSections(project).map(section => <div key={section.title}><h3>{section.title}</h3>{section.bullets?.map(text => <p key={text}>{text}</p>)}</div>)}</Disclosure>
        </div>
      </section>
      <section className={styles.gallery} id="project-gallery" aria-labelledby="warkworth-gallery-title">
        <div className={styles.sectionHeading}><Eyebrow>Around the space</Eyebrow><Heading id="warkworth-gallery-title">A few more perspectives.</Heading></div>
        <ResponsiveGallery label={`${project.title} project gallery`} swipe items={gallery.map((image, index) => ({ id: image.src, image: image.src, alt: image.alt, objectPosition: image.objectPosition, ratio: 'wide', mobileRatio: 'standard', caption: projectImageCaptions[image.src] ?? image.alt, detail: `${index + 1} / ${gallery.length}`, sizes: '(max-width: 1400px) 100vw, 1320px' }))} />
      </section>
      <section className={styles.related} data-related-projects aria-labelledby="warkworth-related-title">
        <div className={styles.sectionHeading}><Eyebrow>More built work</Eyebrow><Heading id="warkworth-related-title">Different homes. Different answers.</Heading></div>
        <div className={styles.relatedGrid}>{relatedProjects.map(related => <Link href={projectHref(related.slug)} key={related.slug} className={styles.relatedLink} aria-label={`View project: ${related.title}`}><Figure image={related.heroImage.src} alt={related.heroImage.alt} objectPosition={related.heroImage.objectPosition} ratio="landscape" sizes="(max-width: 760px) 100vw, 440px" /><span><h3>{related.title}</h3><ArrowUpRight /></span><p>{related.location}</p></Link>)}</div>
      </section>
      <section className={styles.enquiry} aria-labelledby="warkworth-enquiry-title">
        <div><Eyebrow>Your place, your project</Eyebrow><Heading id="warkworth-enquiry-title">An outdoor room<br />of your own.</Heading></div>
        <div><p>Tell us about your space and what you want it to become.</p><Button href={enquiryHref}>Discuss a similar project <ArrowUpRight /></Button><p className={styles.enquiryNote}>Start with your location, a few photos and any dimensions you have.</p></div>
      </section>
      {nextProjectNavigation}
    </article>
  );
}
