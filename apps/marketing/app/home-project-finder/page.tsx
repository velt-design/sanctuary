import ProjectFinderHomepage from '../_home-project-finder/ProjectFinderHomepage';
import { parseProjectFinderRecord } from '../_home-project-finder/projectFinderModel';
import { homeProjectFinderMetadata } from './routeContract';

export const metadata = homeProjectFinderMetadata;

type HomeProjectFinderPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomeProjectFinderPage({
  searchParams,
}: HomeProjectFinderPageProps) {
  const initialState = parseProjectFinderRecord(await searchParams);
  return <ProjectFinderHomepage initialState={initialState} />;
}
