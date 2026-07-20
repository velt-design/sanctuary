import Link from 'next/link';
import type {
  CommandCentreCostingState,
  CommandCentreDeliveryState,
  ProjectCommandCentreCurrentDesign,
} from '@/lib/projects/commandCentre/types';
import styles from './ProjectCurrentDesignCommercialCard.module.css';

const MONEY = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Pacific/Auckland',
});

const COSTING_LABEL: Record<CommandCentreCostingState, string> = {
  current: 'Current costing',
  stored: 'Stored costing',
  may_be_stale: 'Stored costing may be stale',
  unavailable: 'Costing unavailable',
};

const DELIVERY_LABEL: Record<CommandCentreDeliveryState, string> = {
  accepted: 'Accepted',
  sent: 'Sent to customer',
  failed: 'Latest send failed',
  draft: 'Not sent',
  not_applicable: 'Not applicable',
};

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? DATE.format(date) : 'Unknown';
}

function formatPrice(totalIncGstCents: number | null): string {
  return totalIncGstCents === null
    ? 'Price unavailable'
    : `${MONEY.format(totalIncGstCents / 100)} inc GST`;
}

function quoteVersionLabel(data: ProjectCommandCentreCurrentDesign): string {
  if (!data.quote) return 'No current quote';
  const ref = data.quote.quoteRef ?? 'Quote';
  const version = data.quote.versionNumber ? ` v${data.quote.versionNumber}` : '';
  return `${ref}${version}`;
}

export default function ProjectCurrentDesignCommercialCard({
  data,
}: {
  data: ProjectCommandCentreCurrentDesign;
}) {
  return (
    <section
      className={styles.card}
      aria-labelledby="current-design-commercial-heading"
      data-command-centre-source={data.source}
      data-current-design-state={data.designState}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Project overview</p>
          <h2 className={styles.title} id="current-design-commercial-heading">
            Current design &amp; commercial
          </h2>
        </div>
        <span className={`${styles.status} ${styles[`status_${data.statusTone}`]}`}>
          {data.statusLabel}
        </span>
      </header>

      {data.source === 'none' ? (
        <div className={styles.empty}>
          <strong>No current design</strong>
          <span>No estimate or active quote has been saved for this project.</span>
        </div>
      ) : (
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Design</span>
            {data.designState === 'source_unavailable' ? (
              <strong className={styles.unavailable}>Source design unavailable</strong>
            ) : (
              <strong>
                {data.design?.size ?? 'Size not recorded'}
                {data.design && data.design.additionalModuleCount > 0
                  ? ` + ${data.design.additionalModuleCount} more`
                  : ''}
              </strong>
            )}
            <span>
              {data.designState === 'source_unavailable'
                ? 'The selected quote remains current; no other estimate has been substituted.'
                : `${data.design?.shape ?? 'Shape not recorded'} · ${data.design?.roofing ?? 'Roofing not recorded'}`}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Customer price</span>
            <strong>{formatPrice(data.price.totalIncGstCents)}</strong>
            <span>{data.price.source === 'quote' ? 'Stored quote total' : data.price.source === 'estimate' ? 'Stored estimate total' : 'No price source'}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Estimate</span>
            <strong>{data.estimate?.versionLabel ?? 'No source estimate'}</strong>
            <span>
              {data.estimate
                ? `${formatDate(data.estimate.savedAt)} · ${COSTING_LABEL[data.estimate.costingState]}`
                : 'Source record not available'}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Quote</span>
            <strong>{quoteVersionLabel(data)}</strong>
            <span>{data.quote ? DELIVERY_LABEL[data.quote.deliveryState] : 'Estimate-led project'}</span>
          </div>
        </div>
      )}

      {data.latestDeclinedQuote ? (
        <div className={styles.notice} data-command-centre-notice="declined">
          Latest quote outcome: declined. {data.source === 'estimate'
            ? 'The current design falls back to the eligible estimate.'
            : 'No eligible estimate is current.'}
        </div>
      ) : null}
      {data.newerEstimate ? (
        <div className={styles.notice} data-command-centre-notice="newer-estimate">
          A newer unrelated estimate ({data.newerEstimate.versionLabel}, saved {formatDate(data.newerEstimate.savedAt)}) exists.
          The selected quote still controls the current design.
        </div>
      ) : null}
      {data.warnings.includes('source_design_unavailable') ? (
        <div className={styles.warning} data-command-centre-warning="source-design-unavailable">
          Source design unavailable. Review the quote source before relying on design details.
        </div>
      ) : null}
      {data.warnings.includes('quote_price_unavailable') ? (
        <div className={styles.warning} data-command-centre-warning="quote-price-unavailable">
          Stored quote price unavailable. No estimate price has been substituted.
        </div>
      ) : null}
      {data.warnings.includes('multiple_accepted_quotes') ? (
        <div className={styles.warning} data-command-centre-warning="multiple-accepted-quotes">
          Multiple accepted quotes were found. The newest accepted quote is shown; review quote history.
        </div>
      ) : null}

      <footer className={styles.links}>
        {data.links.quote ? <Link href={data.links.quote}>View current quote</Link> : null}
        {data.links.estimate ? <Link href={data.links.estimate}>View source design</Link> : null}
        {!data.links.quote ? <Link href={data.links.quotes}>View quotes</Link> : null}
        {!data.links.estimate ? <Link href={data.links.designs}>View designs</Link> : null}
      </footer>
    </section>
  );
}
