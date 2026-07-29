import Image from 'next/image';
import Link from 'next/link';
import type { Project } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import MobileProjectDisclosure from './MobileProjectDisclosure';
import ProjectGallery from './ProjectGallery';
import {
  getProjectFacts,
  getProjectFeatureTags,
  getProjectFormLabel,
  getProjectIntroCta,
  getProjectMobileFactSummary,
  getProjectTechnicalSections,
} from './projectPresentation';

export type ProjectDetailContentProps = {
  project: Project | null;
  projectIndex: number;
  projectCount: number;
  relatedProjects?: Project[];
  showBreadcrumb?: boolean;
  sourcePath?: string;
  titleAs?: 'h1' | 'h2';
};

export default function ProjectDetailContent({
  project,
  projectIndex,
  projectCount,
  relatedProjects = [],
  showBreadcrumb = false,
  sourcePath,
  titleAs = 'h1',
}: ProjectDetailContentProps) {
  if (!project) {
    return (
      <article className="project-case-study project-case-study--empty">
        <p className="project-case-study__eyebrow">Projects</p>
        <h2>No projects are available</h2>
      </article>
    );
  }

  const TitleTag = titleAs;
  const facts = getProjectFacts(project);
  const mobileFactSummary = getProjectMobileFactSummary(project);
  const features = getProjectFeatureTags(project);
  const technicalSections = getProjectTechnicalSections(project);
  const caseStudyHeroImage = project.caseStudyHeroImage ?? project.heroImage;
  const seenImages = new Set([caseStudyHeroImage.src]);
  const detailImages = project.gallery.filter((image) => {
    if (seenImages.has(image.src)) return false;
    seenImages.add(image.src);
    return true;
  });
  const projectNumber = String(projectIndex + 1).padStart(2, '0');
  const projectTotal = String(projectCount).padStart(2, '0');
  const response = project.description[1] ?? project.description[0];
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
          <span>{project.location}</span>
          <span>{getProjectFormLabel(project)} · {project.type}</span>
        </figcaption>
      </figure>

      <section className="project-case-study__story" aria-labelledby="project-story-title">
        <div className="project-case-study__section-heading">
          <p className="project-case-study__eyebrow">Case study</p>
          <h2 id="project-story-title">Brief and response</h2>
        </div>
        <div className="project-case-study__story-copy">
          <section>
            <h3>Brief</h3>
            <p>{project.constraint}</p>
          </section>
          {response ? (
            <section>
              <h3>Response</h3>
              <p>{response}</p>
            </section>
          ) : null}
        </div>
      </section>

      <section className="project-case-study__facts" aria-labelledby="project-facts-title">
        <div className="project-case-study__section-heading">
          <p className="project-case-study__eyebrow">Project record</p>
          <h2 id="project-facts-title">Facts</h2>
        </div>
        <MobileProjectDisclosure
          bodyClassName="project-case-study__facts-body"
          className="project-case-study__facts-disclosure"
          kind="facts"
          summary={(
            <>
              <span>
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
              <p>Details</p>
              <ul>
                {features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>
          ) : null}
        </MobileProjectDisclosure>
      </section>

      {detailImages.length ? (
        <section className="project-case-study__gallery-section" aria-labelledby="project-gallery-title">
          <div className="project-case-study__gallery-heading">
            <div>
              <p className="project-case-study__eyebrow">Project images</p>
              <h2 id="project-gallery-title">Gallery</h2>
            </div>
          </div>
          <ProjectGallery images={detailImages} projectTitle={project.title} />
        </section>
      ) : null}

      {project.videoYoutubeId ? (
        <section className="project-case-study__video" aria-labelledby="project-video-title">
          <div className="project-case-study__section-heading">
            <p className="project-case-study__eyebrow">Video</p>
            <h2 id="project-video-title">Project film</h2>
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
                <span id="project-technical-title">Technical details</span>
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
              <p className="project-case-study__eyebrow">Next</p>
              <h2 id="related-projects-title">Related projects</h2>
            </div>
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

      <section className="project-case-study__final-cta" aria-labelledby="project-enquiry-title">
        <div>
          <p className="project-case-study__eyebrow">Project brief</p>
          <h2 id="project-enquiry-title">Planning something similar?</h2>
          <p>Send the site, plans or brief.</p>
        </div>
        <Link className="project-action project-action--primary" href={enquiryHref}>
          Send project brief
        </Link>
      </section>
    </article>
  );
}
