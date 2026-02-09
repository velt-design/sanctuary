"use client";

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectTasksSidebarClient from './ProjectTasksSidebar.client';

export default function ProjectTasksSidebar({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectPageSnapshot['tasks'];
}) {
  return <ProjectTasksSidebarClient projectId={projectId} tasks={tasks} />;
}
