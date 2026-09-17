import type { ReactNode } from 'react';
import type { Project } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { buildProjectFinderProjectHref, type ProjectFinderSelection } from '@/lib/projectFinderContinuation';
import { PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE } from '@/lib/projectFinderContract';
import EditorialProjectContent from '@/components/marketing-foundation/editorial/EditorialProjectContent';

export type ProjectDetailContentProps = {
  nextProjectNavigation?: ReactNode;
  project: Project | null;
  projectIndex: number;
  projectCount: number;
  relatedProjects?: Project[];
  showBreadcrumb?: boolean;
  sourcePath?: string;
  titleAs?: 'h1' | 'h2';
  projectFinderSelection?: ProjectFinderSelection | null;
};


export default function ProjectDetailContent({nextProjectNavigation, project, relatedProjects = [], sourcePath, projectFinderSelection = null}: ProjectDetailContentProps) {
  if (!project) return <article><h1>No projects are available</h1></article>;
  const enquiryHref = buildEnquiryHref({
    enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
    sourcePath: sourcePath ?? `/projects/${project.slug}`,
    sourceComponent: 'project_cta',
    sourceProject: project.slug,
    ...(projectFinderSelection
      ? {
          sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
          projectDirection: projectFinderSelection.direction,
          projectPriorities: projectFinderSelection.priorities,
        }
      : {}),
  });
  const projectHref = (slug: string) => projectFinderSelection
    ? buildProjectFinderProjectHref(
        projectFinderSelection.direction,
        projectFinderSelection.priorities,
        slug,
      )
    : `/projects/${slug}`;

  return <EditorialProjectContent nextProjectNavigation={nextProjectNavigation} project={project} enquiryHref={enquiryHref} relatedProjects={relatedProjects} projectHref={projectHref} />;
}
