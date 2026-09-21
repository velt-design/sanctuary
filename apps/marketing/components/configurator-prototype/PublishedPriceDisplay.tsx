import { formatEstimate } from '../../lib/estimateDisplay';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import { reviewMoney } from './ReviewPriceDisplay';
import styles from './prototype.module.css';
import css from './designJourney.module.css';
import {customerPriceBreakdown} from './customerPriceBreakdown';


export default function PublishedPriceDisplay({ value, retry, hasInfills=true, part = 'all' }: { value: ConfiguratorPublicPrice | null; retry: () => void; hasInfills?:boolean; part?: 'all' | 'summary' | 'details' }) {
  if (part === 'details' && value?.status !== 'priced') return null;
  if (!value) return <><p className={styles.priceValue}>Updating estimate…</p></>;
  if (value.status === 'custom') return <><p className={styles.priceValue}>Price to be confirmed.</p><p className={styles.small}>{value.reason}</p></>;
  if (value.status !== 'priced') return <><p>Estimate unavailable. You can keep designing and request a site measure.</p><button className={styles.textButton} onClick={retry}>Retry estimate <ArrowUpRight /></button></>;
  return <>{part !== 'details' && <><p className={styles.priceValue}>{formatEstimate(value.amountIncGst)}</p>
    <p className={styles.small}>Installed estimate · Including GST · Subject to site confirmation</p>

    </>}
    {part !== 'summary' && <><h3 className={css.breakdownTitle}>Your price breakdown</h3><dl className={css.breakdown}>{customerPriceBreakdown(value.breakdown,hasInfills).map((line, index) =>
      <div key={index}><dt>{line.label}</dt><dd>{reviewMoney(line.amountIncGst)}</dd></div>)}</dl><p className={styles.small}>Estimate total rounded to the nearest $5.</p>
    <p className={styles.small}>Selected accessories are included. Foundations, unusual access or fixings, new electrical supply and travel outside our service area are assessed separately before you commit.</p>
  </>}</>;
}
