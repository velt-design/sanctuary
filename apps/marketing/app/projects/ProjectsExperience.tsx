import type { Project } from '@/data/projects';
import ProjectDetailContent from './ProjectDetailContent';
import ProjectNavigator from './ProjectNavigator';
import './projects.css';

type ProjectsExperienceProps = {
  projects: Project[];
  initialSlugFromUrl?: string;
  detailMode?: boolean;
};

export default function ProjectsExperience({
  projects,
  initialSlugFromUrl = '',
  detailMode = false,
}: ProjectsExperienceProps) {
  const selectedIndex = Math.max(
    0,
    projects.findIndex((project) => project.slug === initialSlugFromUrl),
  );
  const selectedProject = projects[selectedIndex] ?? null;

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
  const previousProject = projects.length > 1
    ? projects[(selectedIndex - 1 + projects.length) % projects.length]
    : undefined;
  const nextProject = projects.length > 1
    ? projects[(selectedIndex + 1) % projects.length]
    : undefined;

  return (
    <main
      className="projects-experience"
      aria-label={detailMode ? `${selectedProject.title} project case study` : 'Pergola projects and case studies'}
      data-marketing-foundation-page
      data-projects-experience
    >
      {!detailMode ? (
        <h1 className="visually-hidden">Pergola projects and case studies</h1>
      ) : null}
      <div className="projects-experience__layout">
        <ProjectNavigator projects={projects} activeProject={selectedProject} />
        <ProjectDetailContent
          project={selectedProject}
          projectIndex={selectedIndex}
          projectCount={projects.length}
          relatedProjects={relatedProjects}
          previousProject={previousProject}
          nextProject={nextProject}
          titleAs={detailMode ? 'h1' : 'h2'}
        />
      </div>
    </main>
  );
}
