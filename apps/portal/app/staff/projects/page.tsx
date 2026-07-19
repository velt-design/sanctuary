import ProjectsIndexClient from './ProjectsIndexClient';
import { parseProjectsIndexFilters, todayYmd } from './projectIndexFilters';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StaffProjectsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialFilters = parseProjectsIndexFilters(resolvedSearchParams ?? {});

  return (
    <ProjectsIndexClient
      initialFilters={initialFilters}
      initialTodayYmd={todayYmd()}
    />
  );
}
