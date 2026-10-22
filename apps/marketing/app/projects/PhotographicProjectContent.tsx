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
import { getProjectCaseStudyHero } from './projectSeo';
import type { ProjectEditorialStory } from './projectEditorialStories';
// The accepted Warkworth presentation remains unchanged; reuse its visual vocabulary.
import styles from './warkworth.module.css';

type Props = {
  project: Project;
  story: ProjectEditorialStory;
  enquiryHref: string;
  relatedProjects: Project[];
  projectHref: (slug: string) => string;
  designStartingPoint?: ReactNode;
  nextProjectNavigation?: ReactNode;
};

export default function PhotographicProjectContent({ project, story, enquiryHref, relatedProjects, projectHref, designStartingPoint, nextProjectNavigation }: Props) {
  const hero = getProjectCaseStudyHero(project);
  const photos = [project.heroImage, ...project.gallery];
  const used = new Set([hero.src, ...story.decisions.map(decision => decision.image)]);
  const remaining = project.gallery.filter(image => !used.has(image.src));
  const facts = getProjectFacts(project).filter(fact => ['Dimensions', 'Covered area', 'Roof pitch', 'Completed'].includes(fact.label) && !(story.omitArea && fact.label === 'Covered area'));
  const technical = getProjectTechnicalSections(project);

  return <article className={`${styles.page} project-case-study`} data-project-case-study={project.slug} data-photographic-project aria-labelledby="project-case-study-title">
    <header className={styles.opening}>
      <div><Eyebrow>Built work / {project.location}</Eyebrow><h1 id="project-case-study-title">{project.title}</h1></div>
      <div className={styles.openingCopy}><p>{project.blurb}</p><Button href={enquiryHref}>Discuss a similar project <ArrowUpRight /></Button></div>
    </header>
    <div className={`${styles.hero} project-case-study__hero`}><Figure image={hero.src} alt={hero.alt} objectPosition={hero.objectPosition} ratio="wide" mobileRatio="standard" priority sizes="(max-width: 1400px) 100vw, 1320px" /></div>
    <section className={styles.brief} id="project-story" aria-labelledby="project-brief-title">
      <div><Eyebrow>The brief</Eyebrow><Heading id="project-brief-title">{story.briefTitle}</Heading></div><p>{story.brief ?? project.description[0]}</p>
    </section>
    <section aria-label="Design decisions" className={styles.decisions}>
      {story.decisions.map(decision => {
        const image = photos.find(photo => photo.src === decision.image)!;
        return <div className={styles.decision} key={decision.title} data-project-decision>
          <Figure image={image.src} alt={decision.caption} objectPosition={image.objectPosition} ratio="standard" mobileRatio="standard" caption={decision.caption} sizes="(max-width: 760px) 100vw, 760px" />
          <div className={styles.decisionCopy}><Eyebrow>The design</Eyebrow><Heading>{decision.title}</Heading><p>{decision.text}</p></div>
        </div>;
      })}
    </section>
    <section className={styles.details} id="project-details" aria-labelledby="project-details-title">
      <div><Eyebrow>The completed project</Eyebrow><Heading id="project-details-title">The details.</Heading><p>{story.detailSummary}</p><TextLink href={story.guide.href}>{story.guide.label}</TextLink></div>
      <div><EditorialFacts className="project-case-study__fact-list" items={facts.map(fact => fact.label === 'Dimensions' ? { ...fact, value: <MeasurementGroups value={fact.value} /> } : fact)} />
        {technical.length > 0 && <Disclosure summary="Materials, finishes and project scope" bodyClassName={styles.technical}>{technical.map(section => <div key={section.title}><h3>{section.title}</h3>{(section.bullets?.length ? section.bullets : section.paragraphs).map(text => <p key={text}>{text}</p>)}</div>)}</Disclosure>}
      </div>
    </section>
    {designStartingPoint}
    {remaining.length > 0 && <section className={styles.gallery} id="project-gallery" aria-labelledby="project-gallery-title">
      <div className={styles.sectionHeading}><Eyebrow>Around the space</Eyebrow><Heading id="project-gallery-title">A few more perspectives.</Heading></div>
      <ResponsiveGallery key={project.slug} label={`${project.title} project gallery`} swipe items={remaining.map((image, index) => ({ id: image.src, image: image.src, alt: image.alt, objectPosition: image.objectPosition, ratio: 'wide', mobileRatio: 'standard', caption: projectImageCaptions[image.src] ?? image.alt, detail: `${index + 1} / ${remaining.length}`, sizes: '(max-width: 1400px) 100vw, 1320px' }))} />
    </section>}
    {project.videoYoutubeId && <div className="project-case-study__video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${project.videoYoutubeId}?rel=0`} title={`${project.title} project video`} loading="lazy" allowFullScreen /></div>}
    {relatedProjects.length > 0 && <section className={styles.related} data-related-projects aria-labelledby="project-related-title">
      <div className={styles.sectionHeading}><Eyebrow>More built work</Eyebrow><Heading id="project-related-title">More built work.</Heading></div>
      <div className={styles.relatedGrid}>{relatedProjects.map(related => { const image = getProjectCaseStudyHero(related); return <Link href={projectHref(related.slug)} key={related.slug} className={styles.relatedLink} aria-label={`View project: ${related.title}`}><Figure image={image.src} alt={image.alt} objectPosition={image.objectPosition} ratio="landscape" sizes="(max-width: 760px) 100vw, 440px" /><span><h3>{related.title}</h3><ArrowUpRight /></span><p>{related.location}</p></Link>; })}</div>
    </section>}
    <section className={styles.enquiry} aria-labelledby="project-enquiry-title">
      <div><Eyebrow>{project.type === 'Commercial' ? 'Your site, your brief' : 'Your place, your project'}</Eyebrow><Heading id="project-enquiry-title">{project.type === 'Commercial' ? 'Plan your covered space.' : 'A space of your own.'}</Heading></div>
      <div><p>{project.type === 'Commercial' ? 'Tell us about your site, how it is used and what the cover needs to achieve.' : 'Tell us about your space and what you want it to become.'}</p><Button href={enquiryHref}>Discuss a similar project <ArrowUpRight /></Button><p className={styles.enquiryNote}>Start with your location, a few photos and any dimensions you have.</p></div>
    </section>
    {nextProjectNavigation}
  </article>;
}
