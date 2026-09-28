import ProjectFinderHomepage from './_home-project-finder/ProjectFinderHomepage';
import { parseProjectFinderRecord } from './_home-project-finder/projectFinderModel';
import { projectFinderHomepageMetadata } from './_home-project-finder/routeContract';
import ChallengerHomepage from './_home-project-finder/ChallengerHomepage';
import { isHomepageChallengerPreview } from './_home-project-finder/challengerPreview';

export const metadata = isHomepageChallengerPreview(process.env)
  ? { ...projectFinderHomepageMetadata, robots: { index: false, follow: false } }
  : projectFinderHomepageMetadata;

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const initialState = parseProjectFinderRecord(await searchParams);
  if (isHomepageChallengerPreview(process.env)) return <ChallengerHomepage initialState={initialState} />;
  return <ProjectFinderHomepage initialState={initialState} />;
}
