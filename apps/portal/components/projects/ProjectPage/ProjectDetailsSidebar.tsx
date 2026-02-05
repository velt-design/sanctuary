"use client";

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectDetailsSidebarClient from './ProjectDetailsSidebar.client';

export default function ProjectDetailsSidebar({ project }: { project: ProjectPageSnapshot['project'] }) {
  return <ProjectDetailsSidebarClient project={project} />;
}
