'use client';

import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import styles from './CalculatorPricingSummary.module.css';

export type CalculatorPricingSummaryProps = {
  variant?: 'full' | 'compact';
  resultFreshness: CalculatorResultFreshness;
  issuesCount: number;
  onOpenIssues: () => void;
  customerTotalIncGstCents: number;
  customerTotalExGstCents: number;
  undiscountedTotalIncGstCents?: number | null;
  quoteDiscountPct: number;
  unpricedItemCount: number;
  hasCustomerPricing: boolean;
  canViewInternalCosts: boolean;
  internalTrueCostExGst?: number;
  internalTrueCostIncGst?: number;
  materialsExGst?: number;
  installExGst?: number;
  overheadExGst?: number;
  crewHours?: number;
  installDays?: number;
};

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

const customerPriceNumberFormatter = new Intl.NumberFormat('en-NZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCustomerPriceFromCents(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${customerPriceNumberFormatter.format(Math.round(value / 100))}`;
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric} data-pricing-metric>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function CalculatorPricingSummary({
  variant = 'full',
  resultFreshness,
  issuesCount,
  onOpenIssues,
  customerTotalIncGstCents,
  customerTotalExGstCents,
  undiscountedTotalIncGstCents,
  quoteDiscountPct,
  unpricedItemCount,
  hasCustomerPricing,
  canViewInternalCosts,
  internalTrueCostExGst,
  internalTrueCostIncGst,
  materialsExGst,
  installExGst,
  overheadExGst,
  crewHours,
  installDays,
}: CalculatorPricingSummaryProps) {
  const isLastValid = resultFreshness !== 'current' && hasCustomerPricing;
  const customerPriceLabel = isLastValid
    ? 'Last valid customer price (inc GST)'
    : unpricedItemCount > 0
      ? 'Customer price (priced items only, inc GST)'
      : 'Customer price (inc GST)';

  if (variant === 'compact') {
    return (
      <section
        className={isLastValid ? `${styles.compactSummary} ${styles.compactSummaryStale}` : styles.compactSummary}
        aria-label="Current customer price"
        data-pricing-summary-variant="compact"
        data-result-freshness={resultFreshness}
      >
        <div className={styles.compactPrice}>
          <span className={styles.compactLabel}>{customerPriceLabel}</span>
          <strong className={styles.compactValue}>{hasCustomerPricing ? formatCustomerPriceFromCents(customerTotalIncGstCents) : '—'}</strong>
        </div>
        <div className={styles.compactMeta}>
          <span>Ex GST {hasCustomerPricing ? formatCustomerPriceFromCents(customerTotalExGstCents) : '—'}</span>
          <span>{quoteDiscountPct > 0 ? `${quoteDiscountPct}% discount` : calculatorResultFreshnessLabel(resultFreshness)}</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={isLastValid ? `${styles.summary} ${styles.summaryStale}` : styles.summary}
      aria-label="Pricing preview"
      data-pricing-summary-variant="full"
      data-result-freshness={resultFreshness}
    >
      <header className={styles.header}>
        <div>
          <h2>Pricing preview</h2>
          <p>{calculatorResultFreshnessLabel(resultFreshness)}</p>
        </div>
        {issuesCount > 0 ? (
          <button type="button" className={styles.issueButton} onClick={onOpenIssues}>
            Errors ({issuesCount})
          </button>
        ) : null}
      </header>

      <div className={styles.hero}>
        <span className={styles.heroLabel}>{customerPriceLabel}</span>
        <strong className={styles.heroValue}>{hasCustomerPricing ? formatCustomerPriceFromCents(customerTotalIncGstCents) : '—'}</strong>
        <span className={styles.heroEx}>Customer price (ex GST) {hasCustomerPricing ? formatCustomerPriceFromCents(customerTotalExGstCents) : '—'}</span>
        {quoteDiscountPct > 0 ? (
          <span className={styles.heroExplanation}>
            {quoteDiscountPct}% quote discount applied to pergola and site prices only
          </span>
        ) : null}
        {typeof undiscountedTotalIncGstCents === 'number' ? (
          <span className={styles.heroExplanation}>
            Before discount {formatCustomerPriceFromCents(undiscountedTotalIncGstCents)} inc GST
          </span>
        ) : null}
      </div>

      {canViewInternalCosts ? (
        <details className={styles.internalSection}>
          <summary>Internal costing</summary>
          <dl className={styles.internalGrid} data-pricing-metric-layout="inline">
            <Metric label="True cost (ex GST)" value={formatMoney(internalTrueCostExGst)} />
            <Metric label="True cost (inc GST)" value={formatMoney(internalTrueCostIncGst)} />
            <Metric label="Materials" value={formatMoney(materialsExGst)} />
            <Metric label="Install payout" value={formatMoney(installExGst)} />
            <Metric label="Overhead" value={formatMoney(overheadExGst)} />
            <Metric label="Crew hours" value={formatNumber(crewHours)} />
            <Metric label="Install days" value={formatNumber(installDays, 0)} />
          </dl>
        </details>
      ) : null}
    </section>
  );
}
