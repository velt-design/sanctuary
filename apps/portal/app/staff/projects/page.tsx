import ProjectsIndexClient from './ProjectsIndexClient';
import { parseProjectsIndexFilters, todayYmd } from './projectIndexFilters';
import { loadProjectsIndexData } from '@/lib/projects/serverProjectsIndex';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StaffProjectsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialFilters = parseProjectsIndexFilters(resolvedSearchParams ?? {});
  const { projects, contacts } = await loadProjectsIndexData(undefined, {
    archiveFilter: initialFilters.archiveFilter,
  });

  return (
    <ProjectsIndexClient
      initialProjects={projects}
      initialContacts={contacts}
      initialFilters={initialFilters}
      initialTodayYmd={todayYmd()}
    />
  );
}
