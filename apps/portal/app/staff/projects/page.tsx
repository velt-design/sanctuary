import ProjectsIndexClient from './ProjectsIndexClient';
import { requireStaffPageAccess } from '@/lib/auth';
import { loadProjectsIndexInitialRead } from './loadProjectsIndexInitialRead';
import { parseProjectIndexView, projectsIndexParamsFromView } from './projectIndexView';
import { headers } from 'next/headers';
import { DOCUMENT_CALLBACK_HEADER, regionalDocumentCallback } from '@/lib/regionalDocumentAccess';

export default async function StaffProjectsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaffPageAccess('/staff/projects');
  // Middleware's existing document context selects scheduling only. The fresh
  // page gate above remains mandatory. RSC navigation/prefetch keeps the API read.
  if (!regionalDocumentCallback((await headers()).get(DOCUMENT_CALLBACK_HEADER))) return <ProjectsIndexClient />;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const params = projectsIndexParamsFromView(parseProjectIndexView(search));
  // Pass the in-flight read through Flight. The client keeps its controls
  // mounted while React Query waits; the route never awaits the full index.
  return <ProjectsIndexClient initialRead={loadProjectsIndexInitialRead(session.user.id, params)} />;
}
