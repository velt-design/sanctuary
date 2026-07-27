'use client';

import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import styles from './CalculatorPricingSummary.module.css';

/**
 * The aggregate pricing presentation contract assembled by GridClient.
 * Customer-summary and pricing-detail views intentionally consume different
 * subsets so only one rounded lead total is composed for each layout.
 */
export type CalculatorPricingSummaryProps = {
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

type CalculatorPricingSummaryViewProps = CalculatorPricingSummaryProps & {
  variant: 'compact' | 'inspector';
};

const customerPriceNumberFormatter = new Intl.NumberFormat('en-NZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatRoundedCustomerPriceFromCents(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '\u2014';
  return `$${customerPriceNumberFormatter.format(Math.round(value / 100))}`;
}

function customerPriceLabel({
  isLastValid,
  unpricedItemCount,
}: {
  isLastValid: boolean;
  unpricedItemCount: number;
}): string {
  if (isLastValid && unpricedItemCount > 0) {
    return 'Last valid customer price for priced items (rounded, inc GST)';
  }
  if (isLastValid) return 'Last valid customer price (rounded, inc GST)';
  if (unpricedItemCount > 0) {
    return 'Customer price for priced items (rounded, inc GST)';
  }
  return 'Customer price (rounded, inc GST)';
}

export default function CalculatorPricingSummary({
  variant,
  resultFreshness,
  customerTotalIncGstCents,
  customerTotalExGstCents,
  quoteDiscountPct,
  unpricedItemCount,
  hasCustomerPricing,
}: CalculatorPricingSummaryViewProps) {
  const isLastValid = resultFreshness !== 'current' && hasCustomerPricing;
  const label = customerPriceLabel({ isLastValid, unpricedItemCount });
  const summaryClassName = variant === 'inspector' ? styles.inspectorSummary : styles.compactSummary;
  const staleClassName = variant === 'inspector'
    ? styles.inspectorSummaryStale
    : styles.compactSummaryStale;

  return (
    <section
      className={isLastValid ? `${summaryClassName} ${staleClassName}` : summaryClassName}
      aria-label={isLastValid ? 'Last valid customer price' : 'Customer price summary'}
      data-pricing-summary-variant={variant}
      data-result-freshness={resultFreshness}
      data-rounded-customer-summary
    >
      <div className={styles.primary}>
        <span className={styles.label}>{label}</span>
        <strong className={styles.value}>
          {hasCustomerPricing
            ? formatRoundedCustomerPriceFromCents(customerTotalIncGstCents)
            : '\u2014'}
        </strong>
      </div>

      <div className={styles.secondary}>
        <span>
          Customer price (rounded, ex GST){' '}
          {hasCustomerPricing
            ? formatRoundedCustomerPriceFromCents(customerTotalExGstCents)
            : '\u2014'}
        </span>
        <span>{calculatorResultFreshnessLabel(resultFreshness)}</span>
        {unpricedItemCount > 0 ? (
          <span>
            {unpricedItemCount} unpriced item{unpricedItemCount === 1 ? '' : 's'}
          </span>
        ) : null}
        {quoteDiscountPct > 0 ? <span>{quoteDiscountPct}% discount applied</span> : null}
      </div>
    </section>
  );
}
