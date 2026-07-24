import Image from 'next/image';
import Link from 'next/link';
import type { Project } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import MobileProjectDisclosure from './MobileProjectDisclosure';
import {
  getProjectContextLinks,
  getProjectFacts,
  getProjectFeatureTags,
  getProjectFormLabel,
  getProjectIntroCta,
  getProjectMobileFactSummary,
  getProjectTechnicalSections,
} from './projectPresentation';

type ProjectDetailContentProps = {
  project: Project | null;
  projectIndex: number;
  projectCount: number;
  relatedProjects?: Project[];
  previousProject?: Project;
  nextProject?: Project;
  showBreadcrumb?: boolean;
  sourcePath?: string;
  titleAs?: 'h1' | 'h2';
};

export default function ProjectDetailContent({
  project,
  projectIndex,
  projectCount,
  relatedProjects = [],
  previousProject,
  nextProject,
  showBreadcrumb = false,
  sourcePath,
  titleAs = 'h1',
}: ProjectDetailContentProps) {
  if (!project) {
    return (
      <article className="project-case-study project-case-study--empty">
        <p className="project-case-study__eyebrow">Projects</p>
        <h2>No projects are available</h2>
        <p>Please return soon to explore Sanctuary project case studies.</p>
      </article>
    );
  }

  const TitleTag = titleAs;
  const facts = getProjectFacts(project);
  const mobileFactSummary = getProjectMobileFactSummary(project);
  const features = getProjectFeatureTags(project);
  const technicalSections = getProjectTechnicalSections(project);
  const contextLinks = getProjectContextLinks(project);
  const caseStudyHeroImage = project.caseStudyHeroImage ?? project.heroImage;
  const seenImages = new Set([caseStudyHeroImage.src]);
  const detailImages = project.gallery.filter((image) => {
    if (seenImages.has(image.src)) return false;
    seenImages.add(image.src);
    return true;
  });
  const projectNumber = String(projectIndex + 1).padStart(2, '0');
  const projectTotal = String(projectCount).padStart(2, '0');
  const enquiryHref = buildEnquiryHref({
    enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
    sourcePath: sourcePath ?? `/projects/${project.slug}`,
    sourceComponent: 'project_cta',
    sourceProject: project.slug,
  });

  return (
    <article
      className="project-case-study"
      aria-labelledby="project-case-study-title"
      data-project-case-study={project.slug}
    >
      {showBreadcrumb ? (
        <nav className="project-case-study__breadcrumbs" aria-label="Breadcrumb">
          <Link href="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{project.title}</span>
        </nav>
      ) : null}
      <header className="project-case-study__intro">
        <div className="project-case-study__intro-heading">
          <p className="project-case-study__eyebrow">
            Project {projectNumber} / {projectTotal}
          </p>
          <ul className="project-case-study__meta" aria-label="Project overview">
            <li>{project.location}</li>
            <li>{project.type}</li>
            <li>{getProjectFormLabel(project)}</li>
            {project.year ? <li>{project.year}</li> : null}
          </ul>
          <TitleTag id="project-case-study-title">{project.title}</TitleTag>
        </div>
        <div className="project-case-study__intro-copy">
          <p>{project.blurb}</p>
          <div className="project-case-study__intro-actions">
            <Link className="project-action project-action--primary" href={enquiryHref}>
              {getProjectIntroCta(project)}
            </Link>
            {contextLinks.length ? (
              <nav
                className="project-case-study__context-links"
                aria-label="Related pergola guides"
              >
                {contextLinks.map((link) => (
                  <Link className="project-action project-action--text" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </header>

      <figure className="project-case-study__hero">
        <div className="project-case-study__hero-media">
          <Image
            src={caseStudyHeroImage.src}
            alt={caseStudyHeroImage.alt}
            fill
            priority
            fetchPriority="high"
            sizes="(max-width: 899px) 100vw, (max-width: 1280px) calc(100vw - 320px), 1120px"
            style={{ objectPosition: caseStudyHeroImage.objectPosition ?? 'center' }}
          />
        </div>
        <figcaption>
          <span>{projectNumber} · {project.location}</span>
          <span>{getProjectFormLabel(project)} · {project.type}</span>
        </figcaption>
      </figure>

      <section className="project-case-study__facts" aria-labelledby="project-facts-title">
        <div className="project-case-study__section-heading">
          <p className="project-case-study__eyebrow">Project facts</p>
          <h2 id="project-facts-title">Built details.</h2>
        </div>
        <MobileProjectDisclosure
          bodyClassName="project-case-study__facts-body"
          className="project-case-study__facts-disclosure"
          kind="facts"
          summary={(
            <>
              <span>
                <span className="project-case-study__eyebrow">Built details</span>
                <strong>{mobileFactSummary.measurement}</strong>
                <small>{mobileFactSummary.roofApproach}</small>
              </span>
              <span aria-hidden="true">+</span>
            </>
          )}
        >
            <dl className="project-case-study__fact-list">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            {features.length ? (
              <div className="project-case-study__features">
                <p>Selected details</p>
                <ul>
                  {features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
            ) : null}
        </MobileProjectDisclosure>
      </section>

      <section className="project-case-study__story" aria-labelledby="project-story-title">
        <div className="project-case-study__section-heading">
          <p className="project-case-study__eyebrow">Case study</p>
          <h2 id="project-story-title">The brief and response.</h2>
        </div>
        <div className="project-case-study__story-copy">
          {project.description[0] ? (
            <MobileProjectDisclosure
              bodyClassName="project-case-study__story-disclosure-body"
              className="project-case-study__story-disclosure"
              kind="brief"
              summary={(
                <>
                <span>The original brief</span>
                <span aria-hidden="true">+</span>
                </>
              )}
            >
                <h3>The brief</h3>
                <p>{project.description[0]}</p>
            </MobileProjectDisclosure>
          ) : null}
          <section>
            <h3>Design constraint</h3>
            <p>{project.constraint}</p>
          </section>
          {project.description.length > 1 ? (
            <section>
              <h3>Sanctuary&apos;s response</h3>
              <p>{project.description[1]}</p>
              {project.description.length > 2 ? (
                <MobileProjectDisclosure
                  bodyClassName="project-case-study__story-more-body"
                  className="project-case-study__story-more"
                  kind="response"
                  summary={(
                    <>
                    <span>More about the response</span>
                    <span aria-hidden="true">+</span>
                    </>
                  )}
                >
                    {project.description.slice(2).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                </MobileProjectDisclosure>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>

      {detailImages.length ? (
        <section className="project-case-study__gallery-section" aria-labelledby="project-gallery-title">
          <div className="project-case-study__gallery-heading">
            <div>
              <p className="project-case-study__eyebrow">Project gallery</p>
              <h2 id="project-gallery-title">See the project in detail.</h2>
            </div>
            <p>Swipe through the project on smaller screens.</p>
          </div>
          <div className="project-case-study__gallery">
            {detailImages.map((image, index) => (
              <figure key={image.src}>
                <div className="project-case-study__gallery-media">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 899px) 84vw, (max-width: 1280px) 52vw, 720px"
                    style={{ objectPosition: image.objectPosition ?? 'center' }}
                  />
                </div>
                <figcaption>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{image.alt}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {project.videoYoutubeId ? (
        <section className="project-case-study__video" aria-labelledby="project-video-title">
          <div className="project-case-study__section-heading">
            <p className="project-case-study__eyebrow">Project film</p>
            <h2 id="project-video-title">See the setting in motion.</h2>
          </div>
          <div className="project-case-study__video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${project.videoYoutubeId}?rel=0`}
              title={`${project.title} project video`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      {technicalSections.length ? (
        <section className="project-case-study__technical" aria-labelledby="project-technical-title">
          <MobileProjectDisclosure
            bodyClassName="project-case-study__technical-grid"
            className="project-case-study__technical-disclosure"
            desktopMinWidth={900}
            kind="technical"
            summary={(
              <>
              <span>
                <span className="project-case-study__eyebrow">Project detail</span>
                <span id="project-technical-title">Materials and technical details.</span>
              </span>
              <span aria-hidden="true">+</span>
              </>
            )}
          >
              {technicalSections.map((section, index) => (
                <section key={section.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets?.length ? (
                    <ul>
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  ) : null}
                </section>
              ))}
          </MobileProjectDisclosure>
        </section>
      ) : null}

      {relatedProjects.length ? (
        <section className="project-case-study__related" aria-labelledby="related-projects-title">
          <div className="project-case-study__gallery-heading">
            <div>
              <p className="project-case-study__eyebrow">Continue exploring</p>
              <h2 id="related-projects-title">Related projects.</h2>
            </div>
            <p>Similar forms, settings or project briefs.</p>
          </div>
          <div className="project-case-study__related-list">
            {relatedProjects.map((related) => (
              <Link href={`/projects/${related.slug}`} key={related.slug}>
                <span className="project-case-study__related-image">
                  <Image
                    src={related.heroImage.src}
                    alt={related.heroImage.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 899px) 82vw, (max-width: 1280px) 34vw, 420px"
                    style={{ objectPosition: related.heroImage.objectPosition ?? 'center' }}
                  />
                </span>
                <span className="project-case-study__related-copy">
                  <small>{related.region}</small>
                  <strong>{related.title}</strong>
                  <span>{related.type} · {getProjectFormLabel(related)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {previousProject || nextProject ? (
        <nav className="project-case-study__pagination" aria-label="Previous and next projects">
          {previousProject ? (
            <Link href={`/projects/${previousProject.slug}`} rel="prev">
              <span>Previous project</span>
              <strong>{previousProject.title}</strong>
            </Link>
          ) : <span />}
          {nextProject ? (
            <Link href={`/projects/${nextProject.slug}`} rel="next">
              <span>Next project</span>
              <strong>{nextProject.title}</strong>
            </Link>
          ) : null}
        </nav>
      ) : null}

      <section className="project-case-study__final-cta" aria-labelledby="project-enquiry-title">
        <div>
          <p className="project-case-study__eyebrow">Start a conversation</p>
          <h2 id="project-enquiry-title">Planning a similar project?</h2>
          <p>
            Share the site, plans or early brief. We can help define the right
            response.
          </p>
        </div>
        <Link className="project-action project-action--primary" href={enquiryHref}>
          Send us your project details
        </Link>
      </section>
    </article>
  );
}
