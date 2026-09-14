import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import { reviewMoney } from './ReviewPriceDisplay';
import { hasSimpleRoofPrice } from "./roofFinish";
import StaffRevisionReturn from './StaffRevisionReturn';
import type { PreviewSelection } from './ConfiguratorPrototype';
import ShareDesign from './ShareDesign';
import { displayedEstimate } from './sharedEstimate';
import styles from './journey.module.css';

export default function PreviewNextAction({ selection, reviewPrice }: { selection: PreviewSelection; reviewPrice?: ReviewPrice | null }) {
  const { roof, input, result, configuratorPrice } = selection;
  const configuredMode = configuratorPrice !== undefined && configuratorPrice?.status !== 'disabled';
  const priced = hasSimpleRoofPrice(roof) && result?.status === 'priced' ? result : null;
  const label = !hasSimpleRoofPrice(roof) || result?.status === 'custom' ? 'Pricing confirmed by Sanctuary'
    : !result ? 'Updating estimate…' : 'Estimate unavailable';
  return <footer className={styles.next} aria-label="Continue your design">
    <div className={styles.nextRow}>
      <div className={styles.estimate}>
        <strong>{configuredMode ? configuratorPrice?.status === 'priced' ? `${reviewMoney(configuratorPrice.amountIncGst)} · Installed estimate` : !configuratorPrice ? 'Updating estimate…' : 'Price to be confirmed' : reviewPrice !== undefined ? !reviewPrice ? 'Updating estimate…' : reviewPrice.status === 'priced' ? reviewMoney(reviewPrice.amount) + (reviewPrice.excluded.length ? ' · Subtotal' : ' · Draft estimate') : reviewPrice.status === 'custom' ? 'Your design needs a tailored quote.' : 'Price preview unavailable' : priced ? `From ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(priced.price.fromIncGst)}` : label}</strong>
        {configuredMode ? configuratorPrice?.status === 'priced' && <span>Incl. GST · Subject to site confirmation</span> : reviewPrice?.status === 'priced' ? <span>Incl. GST · Draft rates</span> : reviewPrice === undefined && priced && <span>Incl. GST · Subject to site confirmation</span>}
      </div>
      <StaffRevisionReturn draft={{version: 1, input, roof}} />
    </div>
    <ShareDesign draft={{ version: 1, input, roof }} estimate={displayedEstimate(priced, reviewPrice, configuratorPrice)} />
  </footer>;
}
