import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import { reviewMoney } from './ReviewPriceDisplay';
import styles from './prototype.module.css';
import css from './designJourney.module.css';
import {customerPriceBreakdown} from './customerPriceBreakdown';
import { Fragment, type ReactNode } from 'react';

export default function PublishedPriceDisplay({ value, retry, hasInfills=true, afterSummary }: { value: ConfiguratorPublicPrice | null; retry: () => void; hasInfills?:boolean; afterSummary?:ReactNode }) {
  if (!value) return <><p className={styles.priceValue}>Updating estimate…</p><Fragment key="review-actions">{afterSummary}</Fragment></>;
  if (value.status === 'custom') return <><p className={styles.priceValue}>Price to be confirmed.</p><p className={styles.small}>{value.reason}</p><Fragment key="review-actions">{afterSummary}</Fragment></>;
  if (value.status !== 'priced') return <><p>Estimate unavailable. You can keep designing and request a site measure.</p><button className={styles.textButton} onClick={retry}>Retry estimate <ArrowUpRight /></button><Fragment key="review-actions">{afterSummary}</Fragment></>;
  return <><p className={styles.priceValue}>{reviewMoney(value.amountIncGst)}</p>
    <p className={styles.small}>Installed estimate · Including GST · Subject to site confirmation</p>
    <Fragment key="review-actions">{afterSummary}</Fragment>
    <h3 className={css.breakdownTitle}>Your price breakdown</h3><dl className={css.breakdown}>{customerPriceBreakdown(value.breakdown,hasInfills).map((line, index) =>
      <div key={index}><dt>{line.label}</dt><dd>{reviewMoney(line.amountIncGst)}</dd></div>)}</dl>
    <p className={styles.small}>Selected accessories are included. Foundations, unusual access or fixings, new electrical supply and travel outside our service area are assessed separately before you commit.</p>
  </>;
}
