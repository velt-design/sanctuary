import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import css from './mobileExtras.module.css';

/** Use only the current server-priced selection; never carry an old total across edits. */
export default function MobileExtrasEstimate({ price }: { price?: ConfiguratorPublicPrice | null }) {
  const amount = price?.status === 'priced' ? new Intl.NumberFormat('en-NZ', {
    style: 'currency', currency: 'NZD', maximumFractionDigits: 0,
  }).format(price.amountIncGst) : null;
  return <p className={css.estimate} role="status" aria-live="polite">
    {amount ? <><span>Design total · incl. GST</span><strong>{amount}</strong></>
      : <span>{!price ? 'Updating estimate…' : price.status === 'custom' || price.status === 'disabled' ? 'Price confirmed with your enquiry' : 'Estimate unavailable · continue to review'}</span>}
  </p>;
}
