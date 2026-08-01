import { MarketingPage } from '../../components/marketing-foundation/Primitives';
import { projects } from '../../data/projects';
import GuidedConversation from './GuidedConversation';
import { buildGuidedHomepageMedia } from './guidedConversationMedia';
import GuidedNoScriptFallback from './GuidedNoScriptFallback';
import type { GuidedConversationState } from './guidedConversationModel';
import styles from './guidedHomepage.module.css';

type GuidedHomepageProps = {
  enableProductionAnalytics?: boolean;
  initialState: GuidedConversationState;
};

export default function GuidedHomepage({
  enableProductionAnalytics = false,
  initialState,
}: GuidedHomepageProps) {
  const media = buildGuidedHomepageMedia(projects);

  return (
    <MarketingPage
      className={styles.page}
      data-guided-production-analytics={enableProductionAnalytics ? 'enabled' : 'disabled'}
    >
      <GuidedConversation initialState={initialState} media={media} />
      <GuidedNoScriptFallback />
    </MarketingPage>
  );
}
