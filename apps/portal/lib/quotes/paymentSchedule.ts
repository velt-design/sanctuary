type QuotePaymentTermCalculation = 'fixed' | 'percentage';

export type QuotePaymentTerm = {
  id: string;
  label: string;
  calculationType: QuotePaymentTermCalculation;
  fixedAmountIncGstCents: number | null;
  percentageOfRemainder: number | null;
  resolvedAmountIncGstCents: number;
};

type QuotePaymentScheduleEvaluation = {
  terms: QuotePaymentTerm[];
  errors: string[];
  fixedTotalIncGstCents: number;
  percentageTotal: number;
  percentagePoolIncGstCents: number;
  allocatedTotalIncGstCents: number;
};

const MAX_PAYMENT_TERMS = 10;

function roundCents(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function roundPercentage(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

function cleanLabel(value: unknown, index: number): string {
  const label = typeof value === 'string' ? value.trim() : '';
  return label.slice(0, 120) || `Payment ${index + 1}`;
}

function cleanId(value: unknown, index: number): string {
  const id = typeof value === 'string' ? value.trim() : '';
  return id.slice(0, 80) || `payment-${index + 1}`;
}

export function evaluateQuotePaymentSchedule(
  input: readonly QuotePaymentTerm[],
  quoteTotalIncGstCents: number,
): QuotePaymentScheduleEvaluation {
  const quoteTotal = roundCents(quoteTotalIncGstCents);
  const source = Array.isArray(input) ? input.slice(0, MAX_PAYMENT_TERMS) : [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  if (!source.length) errors.push('Add at least one payment term.');
  if (input.length > MAX_PAYMENT_TERMS) errors.push(`Use no more than ${MAX_PAYMENT_TERMS} payment terms.`);

  const normalized = source.map((term, index): QuotePaymentTerm => {
    const calculationType: QuotePaymentTermCalculation = term?.calculationType === 'fixed' ? 'fixed' : 'percentage';
    const id = cleanId(term?.id, index);
    if (seenIds.has(id)) errors.push(`Payment term ${index + 1} has a duplicate ID.`);
    seenIds.add(id);
    const fixedAmountIncGstCents = calculationType === 'fixed'
      ? roundCents(term?.fixedAmountIncGstCents)
      : null;
    const percentageOfRemainder = calculationType === 'percentage'
      ? roundPercentage(term?.percentageOfRemainder)
      : null;
    if (calculationType === 'fixed' && (fixedAmountIncGstCents ?? 0) <= 0) {
      errors.push(`${cleanLabel(term?.label, index)} needs a fixed amount greater than $0.`);
    }
    if (calculationType === 'percentage' && (percentageOfRemainder ?? 0) <= 0) {
      errors.push(`${cleanLabel(term?.label, index)} needs a percentage greater than 0%.`);
    }
    return {
      id,
      label: cleanLabel(term?.label, index),
      calculationType,
      fixedAmountIncGstCents,
      percentageOfRemainder,
      resolvedAmountIncGstCents: 0,
    };
  });

  const fixedTotal = normalized.reduce(
    (sum, term) => sum + (term.calculationType === 'fixed' ? term.fixedAmountIncGstCents ?? 0 : 0),
    0,
  );
  const percentageTerms = normalized.filter((term) => term.calculationType === 'percentage');
  const percentageTotal = percentageTerms.reduce((sum, term) => sum + (term.percentageOfRemainder ?? 0), 0);
  const percentagePool = Math.max(0, quoteTotal - fixedTotal);

  if (fixedTotal > quoteTotal) errors.push('Fixed payment terms exceed the quote total.');
  if (percentagePool > 0 && !percentageTerms.length) errors.push('Allocate the remaining quote balance with percentage terms.');
  if (percentageTerms.length && Math.abs(percentageTotal - 100) > 0.001) {
    errors.push('Percentage payment terms must total exactly 100%.');
  }
  if (percentagePool === 0 && percentageTerms.length) {
    errors.push('Remove percentage terms when fixed payments allocate the full quote total.');
  }

  let percentageAllocated = 0;
  let percentageIndex = 0;
  const resolved = normalized.map((term) => {
    if (term.calculationType === 'fixed') {
      return { ...term, resolvedAmountIncGstCents: term.fixedAmountIncGstCents ?? 0 };
    }
    percentageIndex += 1;
    const isLastPercentage = percentageIndex === percentageTerms.length;
    const amount = isLastPercentage
      ? Math.max(0, percentagePool - percentageAllocated)
      : Math.round(percentagePool * ((term.percentageOfRemainder ?? 0) / 100));
    percentageAllocated += amount;
    return { ...term, resolvedAmountIncGstCents: amount };
  });
  const allocatedTotal = resolved.reduce((sum, term) => sum + term.resolvedAmountIncGstCents, 0);
  if (!errors.length && allocatedTotal !== quoteTotal) errors.push('Payment terms do not reconcile to the quote total.');

  return {
    terms: resolved,
    errors: [...new Set(errors)],
    fixedTotalIncGstCents: fixedTotal,
    percentageTotal,
    percentagePoolIncGstCents: percentagePool,
    allocatedTotalIncGstCents: allocatedTotal,
  };
}

export function requireValidQuotePaymentSchedule(
  input: readonly QuotePaymentTerm[],
  quoteTotalIncGstCents: number,
): QuotePaymentTerm[] {
  const evaluation = evaluateQuotePaymentSchedule(input, quoteTotalIncGstCents);
  if (evaluation.errors.length) throw new Error(evaluation.errors.join(' '));
  return evaluation.terms;
}

export function buildLegacyQuotePaymentSchedule(
  quoteTotalIncGstCents: number,
  depositPercent = 50,
): QuotePaymentTerm[] {
  const firstPercentage = Math.max(0, Math.min(100, roundPercentage(depositPercent)));
  const terms: QuotePaymentTerm[] = firstPercentage <= 0
    ? [{
        id: 'payment-1',
        label: 'Final payment',
        calculationType: 'percentage',
        fixedAmountIncGstCents: null,
        percentageOfRemainder: 100,
        resolvedAmountIncGstCents: 0,
      }]
    : firstPercentage >= 100
    ? [{
        id: 'payment-1',
        label: 'Initial payment',
        calculationType: 'percentage',
        fixedAmountIncGstCents: null,
        percentageOfRemainder: 100,
        resolvedAmountIncGstCents: 0,
      }]
    : [
        {
          id: 'payment-1',
          label: 'Initial payment',
          calculationType: 'percentage',
          fixedAmountIncGstCents: null,
          percentageOfRemainder: firstPercentage,
          resolvedAmountIncGstCents: 0,
        },
        {
          id: 'payment-2',
          label: 'Final payment',
          calculationType: 'percentage',
          fixedAmountIncGstCents: null,
          percentageOfRemainder: 100 - firstPercentage,
          resolvedAmountIncGstCents: 0,
        },
      ];
  return requireValidQuotePaymentSchedule(terms, quoteTotalIncGstCents);
}

export function buildDefaultQuotePaymentSchedule(params: {
  quoteTotalIncGstCents: number;
  approvalRequirement?: 'neither' | 'engineering_required' | 'full_building_consent' | null;
  approvalIncGstCents?: number | null;
}): QuotePaymentTerm[] {
  const approvalAmount = roundCents(params.approvalIncGstCents);
  const hasConsentUpfront = params.approvalRequirement === 'full_building_consent'
    && approvalAmount > 0
    && approvalAmount < roundCents(params.quoteTotalIncGstCents);
  if (!hasConsentUpfront) return buildLegacyQuotePaymentSchedule(params.quoteTotalIncGstCents, 50);
  return requireValidQuotePaymentSchedule([
    {
      id: 'payment-1',
      label: 'Consent and engineering',
      calculationType: 'fixed',
      fixedAmountIncGstCents: approvalAmount,
      percentageOfRemainder: null,
      resolvedAmountIncGstCents: approvalAmount,
    },
    {
      id: 'payment-2',
      label: 'Construction payment',
      calculationType: 'percentage',
      fixedAmountIncGstCents: null,
      percentageOfRemainder: 50,
      resolvedAmountIncGstCents: 0,
    },
    {
      id: 'payment-3',
      label: 'Final payment',
      calculationType: 'percentage',
      fixedAmountIncGstCents: null,
      percentageOfRemainder: 50,
      resolvedAmountIncGstCents: 0,
    },
  ], params.quoteTotalIncGstCents);
}

export function normalizeStoredQuotePaymentSchedule(
  value: unknown,
  quoteTotalIncGstCents: number,
  legacyDepositPercent = 50,
): QuotePaymentTerm[] {
  if (value === null || value === undefined) {
    return buildLegacyQuotePaymentSchedule(quoteTotalIncGstCents, legacyDepositPercent);
  }
  if (!Array.isArray(value)) {
    throw new Error('Stored quote payment schedule is malformed. Repair the quote terms before continuing.');
  }
  const evaluation = evaluateQuotePaymentSchedule(value as QuotePaymentTerm[], quoteTotalIncGstCents);
  if (evaluation.errors.length) {
    throw new Error(`Stored quote payment schedule is invalid: ${evaluation.errors.join(' ')}`);
  }
  return evaluation.terms;
}

export function paymentScheduleCompatibilityDepositPercent(
  terms: readonly QuotePaymentTerm[],
  quoteTotalIncGstCents: number,
): number {
  const total = roundCents(quoteTotalIncGstCents);
  const firstAmount = roundCents(terms[0]?.resolvedAmountIncGstCents);
  if (total <= 0) return 50;
  return Math.round(Math.max(0, Math.min(100, (firstAmount / total) * 100)) * 100) / 100;
}

function paymentScheduleSummary(terms: readonly QuotePaymentTerm[]): string {
  return terms.map((term) => {
    const basis = term.calculationType === 'fixed'
      ? `$${((term.fixedAmountIncGstCents ?? 0) / 100).toFixed(2)}`
      : `${term.percentageOfRemainder ?? 0}% of the balance after fixed payments`;
    return `${term.label}: ${basis}`;
  }).join('; ');
}

const LEGACY_DEPOSIT_TERMS_LINE = /A\s+\d+(?:\.\d+)?%\s+deposit\s+is\s+required\s+to\s+confirm\s+your\s+booking\.?/i;
const PAYMENT_SCHEDULE_TERMS_LINE = /Payment schedule:\s*[^\r\n]*/i;

export function applyPaymentScheduleToTerms(
  terms: string | null | undefined,
  paymentTerms: readonly QuotePaymentTerm[],
): string {
  const scheduleLine = `Payment schedule: ${paymentScheduleSummary(paymentTerms)}.`;
  const base = String(terms ?? '').trim();
  if (!base) return scheduleLine;
  if (PAYMENT_SCHEDULE_TERMS_LINE.test(base)) {
    return base.replace(PAYMENT_SCHEDULE_TERMS_LINE, scheduleLine);
  }
  if (LEGACY_DEPOSIT_TERMS_LINE.test(base)) {
    return base.replace(LEGACY_DEPOSIT_TERMS_LINE, scheduleLine);
  }
  const lines = base.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  lines.splice(Math.min(1, lines.length), 0, scheduleLine);
  return lines.join('\n');
}
