import GuidedHomepage from '../_home-guided/GuidedHomepage';
import { parseGuidedConversationRecord } from '../_home-guided/guidedConversationModel';
import {
  HOME_GUIDED_ENABLE_PRODUCTION_ANALYTICS,
  homeGuidedMetadata,
} from './routeContract';

export const metadata = homeGuidedMetadata;

type HomeGuidedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomeGuidedPage({
  searchParams,
}: HomeGuidedPageProps) {
  const initialState = parseGuidedConversationRecord(await searchParams);
  return (
    <GuidedHomepage
      enableProductionAnalytics={HOME_GUIDED_ENABLE_PRODUCTION_ANALYTICS}
      initialState={initialState}
    />
  );
}
