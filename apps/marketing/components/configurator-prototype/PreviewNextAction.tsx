import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import JourneyEstimate from './JourneyEstimate';
import { hasSimpleRoofPrice } from "./roofFinish";
import StaffRevisionReturn from './StaffRevisionReturn';
import type { PreviewSelection } from './ConfiguratorPrototype';
import ShareDesign from './ShareDesign';
import { displayedEstimate } from './sharedEstimate';
import styles from './journey.module.css';
import { useRail } from './RailProvider';
import JourneyNavigation from './JourneyNavigation';

export default function PreviewNextAction({ selection, reviewPrice, retry }: { selection: PreviewSelection; reviewPrice?: ReviewPrice | null; retry?: () => void }) {
  const { roof, input, result, configuratorPrice } = selection;
  const { section } = useRail();
  const priced = hasSimpleRoofPrice(roof) && result?.status === 'priced' ? result : null;
  return <footer className={styles.next} data-review={section==='review'} aria-label="Continue your design">
    <div className={styles.nextRow}>
      <div className={styles.mobileEstimate}><JourneyEstimate retry={retry} selection={selection} reviewPrice={reviewPrice}/></div>
      {section === 'review' && <StaffRevisionReturn draft={{version: 1, input, roof}} />}
    </div>
    <JourneyNavigation />
    {section === 'review' && <ShareDesign draft={{ version: 1, input, roof }} estimate={displayedEstimate(priced, reviewPrice, configuratorPrice)} />}
  </footer>;
}
