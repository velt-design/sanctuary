import { parseProjectFinderRecord } from './_home-project-finder/projectFinderModel';
import { projectFinderHomepageMetadata } from './_home-project-finder/routeContract';
import ChallengerHomepage from './_home-project-finder/ChallengerHomepage';

export const metadata = projectFinderHomepageMetadata;

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const initialState = parseProjectFinderRecord(await searchParams);
  return <ChallengerHomepage initialState={initialState} />;
}
