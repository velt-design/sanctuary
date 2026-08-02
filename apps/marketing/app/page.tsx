import ProjectFinderHomepage from './_home-project-finder/ProjectFinderHomepage';
import { parseProjectFinderRecord } from './_home-project-finder/projectFinderModel';
import { projectFinderHomepageMetadata } from './_home-project-finder/routeContract';

export const metadata = projectFinderHomepageMetadata;

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const initialState = parseProjectFinderRecord(await searchParams);
  return <ProjectFinderHomepage initialState={initialState} />;
}
