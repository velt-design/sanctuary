'use client';

import type { CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import styles from './CalculatorPricingDetails.module.css';

export type CalculatorPricingDetailsProps = Pick<
  CalculatorPricingSummaryProps,
  | 'undiscountedTotalIncGstCents'
  | 'quoteDiscountPct'
  | 'unpricedItemCount'
  | 'canViewInternalCosts'
  | 'internalTrueCostExGst'
  | 'internalTrueCostIncGst'
  | 'materialsExGst'
  | 'installExGst'
  | 'overheadExGst'
  | 'crewHours'
  | 'installDays'
>;

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '\u2014';
  return `$${value.toFixed(2)}`;
}

const exactCustomerPriceFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatExactCustomerPriceFromCents(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  return exactCustomerPriceFormatter.format(value / 100);
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '\u2014';
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

export default function CalculatorPricingDetails({
  undiscountedTotalIncGstCents,
  quoteDiscountPct,
  unpricedItemCount,
  canViewInternalCosts,
  internalTrueCostExGst,
  internalTrueCostIncGst,
  materialsExGst,
  installExGst,
  overheadExGst,
  crewHours,
  installDays,
}: CalculatorPricingDetailsProps) {
  const hasBeforeDiscountContext = typeof undiscountedTotalIncGstCents === 'number'
    && Number.isFinite(undiscountedTotalIncGstCents);
  const hasDiscountContext = quoteDiscountPct > 0 || hasBeforeDiscountContext;
  const hasCustomerContext = hasDiscountContext || unpricedItemCount > 0;

  if (!hasCustomerContext && !canViewInternalCosts) return null;

  return (
    <section className={styles.details} aria-label="Pricing details" data-pricing-details>
      {hasCustomerContext ? (
        <div className={styles.customerContext}>
          <h2>Pricing details</h2>
          {quoteDiscountPct > 0 ? (
            <p>
              {quoteDiscountPct}% quote discount applies to pergola and site prices only.
            </p>
          ) : null}
          {hasBeforeDiscountContext ? (
            <dl className={styles.beforeDiscount}>
              <dt>Before discount (inc GST)</dt>
              <dd>{formatExactCustomerPriceFromCents(undiscountedTotalIncGstCents)}</dd>
            </dl>
          ) : null}
          {unpricedItemCount > 0 ? (
            <p className={styles.unpriced} role="note">
              {unpricedItemCount} item{unpricedItemCount === 1 ? ' is' : 's are'} not priced.
              {' '}Totals include priced items only.
            </p>
          ) : null}
        </div>
      ) : null}

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
