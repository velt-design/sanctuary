"use client";

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectTasksSidebarClient from './ProjectTasksSidebar.client';

export default function ProjectTasksSidebar({ tasks }: { tasks: ProjectPageSnapshot['tasks'] }) {
  return <ProjectTasksSidebarClient tasks={tasks} />;
}
