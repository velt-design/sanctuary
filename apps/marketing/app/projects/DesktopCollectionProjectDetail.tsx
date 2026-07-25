'use client';

import {
  useEffect,
  useState,
  type ComponentType,
} from 'react';
import type { Project } from '@/data/projects';
import type { ProjectDetailContentProps } from './ProjectDetailContent';

type LoadedProjectDetail = {
  Component: ComponentType<ProjectDetailContentProps>;
  nextProject?: Project;
  previousProject?: Project;
  project: Project;
  projectCount: number;
  projectIndex: number;
  relatedProjects: Project[];
};

type DesktopCollectionProjectDetailProps = {
  initialSlug: string;
};

function resolveProjectDetail(
  projectRecords: Project[],
  initialSlug: string,
  Component: ComponentType<ProjectDetailContentProps>,
): LoadedProjectDetail | null {
  const projectIndex = Math.max(
    0,
    projectRecords.findIndex((project) => project.slug === initialSlug),
  );
  const project = projectRecords[projectIndex];
  if (!project) return null;

  return {
    Component,
    nextProject: projectRecords.length > 1
      ? projectRecords[(projectIndex + 1) % projectRecords.length]
      : undefined,
    previousProject: projectRecords.length > 1
      ? projectRecords[
        (projectIndex - 1 + projectRecords.length) % projectRecords.length
      ]
      : undefined,
    project,
    projectCount: projectRecords.length,
    projectIndex,
    relatedProjects: (project.related ?? [])
      .map((slug) => projectRecords.find((candidate) => candidate.slug === slug))
      .filter((candidate): candidate is Project => Boolean(candidate)),
  };
}

export default function DesktopCollectionProjectDetail({
  initialSlug,
}: DesktopCollectionProjectDetailProps) {
  const [loadedDetail, setLoadedDetail] = useState<LoadedProjectDetail | null>(
    null,
  );

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 900px)');
    let cancelled = false;

    const update = async () => {
      if (!desktopQuery.matches) {
        setLoadedDetail(null);
        return;
      }

      const [
        { default: ProjectDetailContent },
        { projects: projectRecords },
      ] = await Promise.all([
        import('./ProjectDetailContent'),
        import('@/data/projects'),
      ]);

      if (cancelled || !desktopQuery.matches) return;
      setLoadedDetail(resolveProjectDetail(
        projectRecords,
        initialSlug,
        ProjectDetailContent,
      ));
    };

    void update();
    desktopQuery.addEventListener('change', update);
    return () => {
      cancelled = true;
      desktopQuery.removeEventListener('change', update);
    };
  }, [initialSlug]);

  if (!loadedDetail) return null;

  const {
    Component,
    nextProject,
    previousProject,
    project,
    projectCount,
    projectIndex,
    relatedProjects,
  } = loadedDetail;

  return (
    <Component
      project={project}
      projectIndex={projectIndex}
      projectCount={projectCount}
      relatedProjects={relatedProjects}
      previousProject={previousProject}
      nextProject={nextProject}
      sourcePath="/projects"
      titleAs="h2"
    />
  );
}
