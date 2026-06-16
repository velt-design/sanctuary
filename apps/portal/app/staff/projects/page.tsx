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
  // PR-PG1 (2026-06-16): server-fetched projects + contacts now arrive as
  // `{ rows, totalCount }` so the page can render a `ListCountBanner`
  // when either list approaches the silent-truncation ceiling.
  const { projects, contacts } = await loadProjectsIndexData(undefined, {
    archiveFilter: initialFilters.archiveFilter,
  });

  return (
    <ProjectsIndexClient
      initialProjects={projects.rows}
      initialProjectsTotalCount={projects.totalCount}
      initialProjectsTruncated={projects.truncated}
      initialContacts={contacts.rows}
      initialContactsTotalCount={contacts.totalCount}
      initialContactsTruncated={contacts.truncated}
      initialFilters={initialFilters}
      initialTodayYmd={todayYmd()}
    />
  );
}
