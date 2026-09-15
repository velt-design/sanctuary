import { useEffect, useRef } from 'react';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import { reviewMoney } from './ReviewPriceDisplay';
import { hasSimpleRoofPrice } from "./roofFinish";
import type { PreviewSelection } from './ConfiguratorPrototype';
import styles from './journey.module.css';
import { useRail } from './RailProvider';
import css from './designJourney.module.css';

export default function JourneyEstimate({selection,reviewPrice}:{selection:PreviewSelection;reviewPrice?:ReviewPrice|null}){
  const { roof, result, configuratorPrice } = selection;
  const { section, choose } = useRail();
  const openRequested = useRef(false);
  function focusBreakdown() {
    const panel = document.getElementById('configurator-price-breakdown');
    panel?.scrollIntoView({ block: 'start' });
    panel?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (section === 'review' && openRequested.current) {
      openRequested.current = false;
      focusBreakdown();
    }
  }, [section]);
  function openBreakdown() {
    if (section === 'review') focusBreakdown();
    else { openRequested.current = true; choose('review'); }
  }
  const configuredMode = configuratorPrice !== undefined && configuratorPrice?.status !== 'disabled';
  const priced = hasSimpleRoofPrice(roof) && result?.status === 'priced' ? result : null;
  const label = !hasSimpleRoofPrice(roof) || result?.status === 'custom' ? 'Pricing confirmed by Sanctuary'
    : !result ? 'Updating estimate…' : 'Estimate unavailable';
return <div className={css.estimate} aria-live="polite" aria-atomic="true">      <div className={styles.estimate}>
        <button className={css.priceLink} onClick={openBreakdown} aria-label="View full price breakdown"><strong>{configuredMode ? configuratorPrice?.status === 'priced' ? reviewMoney(configuratorPrice.amountIncGst) : !configuratorPrice ? 'Updating estimate…' : 'Price to be confirmed' : reviewPrice !== undefined ? !reviewPrice ? 'Updating estimate…' : reviewPrice.status === 'priced' ? reviewMoney(reviewPrice.amount) + (reviewPrice.excluded.length ? ' · Subtotal' : ' · Draft estimate') : reviewPrice.status === 'custom' ? 'Your design needs a tailored quote.' : 'Price preview unavailable' : priced ? `From ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(priced.price.fromIncGst)}` : label}</strong></button>
        <span>Installed estimate</span>
      </div>
</div>;
}
