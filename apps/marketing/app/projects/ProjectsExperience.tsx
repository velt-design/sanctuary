import Link from 'next/link';
import type { Project } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import DesktopCollectionProjectDetail from './DesktopCollectionProjectDetail';
import ProjectDetailContent from './ProjectDetailContent';
import ProjectNavigator from './ProjectNavigator';
import { getProjectCollectionItems } from './projectCollection';
import './projects.css';
import './projectCollection.css';

type ProjectsExperienceProps = {
  projects: Project[];
  initialSlugFromUrl?: string;
  initialSearchParams?: string;
  detailMode?: boolean;
};

export default function ProjectsExperience({
  projects,
  initialSlugFromUrl = '',
  initialSearchParams = '',
  detailMode = false,
}: ProjectsExperienceProps) {
  const selectedIndex = Math.max(
    0,
    projects.findIndex((project) => project.slug === initialSlugFromUrl),
  );
  const selectedProject = projects[selectedIndex] ?? null;
  const collectionProjects = getProjectCollectionItems(projects);
  const collectionEnquiryHref = buildEnquiryHref({
    sourcePath: '/projects',
    sourceComponent: 'final_cta',
  });

  if (!selectedProject) {
    return (
      <main className="projects-experience" data-marketing-foundation-page>
        <ProjectDetailContent
          project={null}
          projectIndex={0}
          projectCount={0}
          titleAs="h1"
        />
      </main>
    );
  }

  const relatedProjects = (selectedProject.related ?? [])
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter((project): project is Project => Boolean(project));
  return (
    <main
      className={`projects-experience${detailMode ? '' : ' projects-experience--collection'}`}
      aria-label={detailMode ? `${selectedProject.title} project case study` : 'Pergola projects and case studies'}
      data-marketing-foundation-page
      data-projects-experience
    >
      {!detailMode ? (
        <h1 className="projects-experience__collection-title">
          Pergola projects and case studies
        </h1>
      ) : null}
      <div className="projects-experience__layout">
        <ProjectNavigator
          projects={collectionProjects}
          activeProject={collectionProjects[selectedIndex]!}
          collectionMode={!detailMode}
          initialSearchParams={initialSearchParams}
        />
        {detailMode ? (
          <ProjectDetailContent
            project={selectedProject}
            projectIndex={selectedIndex}
            projectCount={projects.length}
            relatedProjects={relatedProjects}
            showBreadcrumb
            sourcePath={`/projects/${selectedProject.slug}`}
            titleAs="h1"
          />
        ) : (
          <DesktopCollectionProjectDetail initialSlug={selectedProject.slug} />
        )}
      </div>
      {!detailMode ? (
        <section
          className="projects-experience__collection-close"
          aria-labelledby="projects-collection-enquiry-title"
          data-project-collection-cta
        >
          <div>
            <p>Next step</p>
            <h2 id="projects-collection-enquiry-title">Have a project in mind?</h2>
            <p>Share a few details, photos or rough dimensions. We can help shape the next step.</p>
          </div>
          <Link className="project-action project-action--primary" href={collectionEnquiryHref}>
            Start your project
          </Link>
        </section>
      ) : null}
    </main>
  );
}
