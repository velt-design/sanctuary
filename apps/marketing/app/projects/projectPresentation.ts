import type { Project } from '../../data/projects';

type ProjectFact = {
  label: string;
  value: string;
};

type ProjectContextLink = {
  href: string;
  label: string;
};

type ProjectMobileFactSummary = {
  measurement: string;
  roofApproach: string;
};

export function getProjectFormLabel(
  project: Pick<Project, 'roof'>,
): string {
  return project.roof === 'Perimeter' ? 'Box-perimeter' : project.roof;
}

function getProjectDimensions(project: Project): string {
  return [
    project.stats.width ? `${project.stats.width} W` : '',
    project.stats.depth ? `${project.stats.depth} D` : '',
    project.stats.height ? `${project.stats.height} H` : '',
  ].filter(Boolean).join(' × ');
}

export function getProjectMobileFactSummary(
  project: Project,
): ProjectMobileFactSummary {
  return {
    measurement:
      getProjectDimensions(project)
      || project.stats.area
      || getProjectFormLabel(project),
    roofApproach: project.roofApproach,
  };
}

export function getProjectFacts(project: Project): ProjectFact[] {
  const dimensions = getProjectDimensions(project);

  return [
    { label: 'Project type', value: project.type },
    { label: 'Pergola form', value: getProjectFormLabel(project) },
    { label: 'Configuration', value: project.configuration ?? '' },
    { label: 'Region', value: project.region },
    { label: 'Dimensions', value: dimensions },
    { label: 'Covered area', value: project.stats.area ?? '' },
    { label: 'Roof pitch', value: project.stats.pitch ?? '' },
    { label: 'Roof approach', value: project.roofApproach },
    { label: 'Structure & finish', value: project.materials?.join(', ') ?? '' },
    { label: 'Completed', value: project.year },
  ].filter((fact) => fact.value.trim().length > 0);
}

export function getProjectFeatureTags(project: Project): string[] {
  const baseTags = new Set([
    project.type.toLowerCase(),
    project.roof.toLowerCase(),
    getProjectFormLabel(project).toLowerCase(),
    'residential',
    'commercial',
  ]);

  return project.tags.filter((tag) => !baseTags.has(tag.toLowerCase()));
}

export function getProjectTechnicalSections(project: Project): Project['sections'] {
  return project.sections.filter((section) => !/^design brief$/i.test(section.title));
}

export function getProjectIntroCta(project: Project): string {
  return project.type === 'Commercial'
    ? 'Share plans or a project brief'
    : 'Discuss a similar project';
}

export function getProjectContextLinks(project: Project): ProjectContextLink[] {
  const candidates: ProjectContextLink[] = [];

  if (project.tags.some((tag) => /outdoor room/i.test(tag))) {
    candidates.push({ href: '/outdoor-rooms-auckland', label: 'Explore outdoor rooms' });
  }

  if (project.type === 'Commercial') {
    candidates.push({ href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' });
  }

  if (project.roof === 'Gable') {
    candidates.push({ href: '/gable-pergolas-auckland', label: 'Explore gable pergolas' });
  } else if (project.roof === 'Pitched') {
    candidates.push({ href: '/pitched-pergolas-auckland', label: 'Explore pitched pergolas' });
  } else {
    candidates.push({ href: '/custom-pergolas-auckland', label: 'Explore custom pergolas' });
  }

  if (/acrylic/i.test(project.roofApproach)) {
    candidates.push({
      href: '/acrylic-roof-pergolas-auckland',
      label: 'Explore acrylic roof pergolas',
    });
  }

  return candidates
    .filter((candidate, index, links) => (
      links.findIndex((link) => link.href === candidate.href) === index
    ))
    .slice(0, 2);
}
