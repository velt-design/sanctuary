export const DEFAULT_QUOTE_INTRO = `Thank you for the opportunity to quote for your pergola. Please review the scope and let us know if you would like to proceed.`;

const DEPOSIT_TERMS_LINE_PATTERN = /A\s+\d+(?:\.\d+)?%\s+deposit\s+is\s+required\s+to\s+confirm\s+your\s+booking\.?/i;

function clampDepositPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function normalizeDepositPercent(value: unknown, fallback = 50): number {
  const n = typeof value === 'number' ? value : Number(value ?? fallback);
  if (!Number.isFinite(n)) return clampDepositPercent(fallback);
  return clampDepositPercent(n);
}

export function formatDepositPercent(value: number): string {
  const n = normalizeDepositPercent(value);
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function depositTermsLine(value: number): string {
  return `A ${formatDepositPercent(value)}% deposit is required to confirm your booking.`;
}

export function applyDepositPercentToTerms(terms: string | null | undefined, value: number): string {
  const depositLine = depositTermsLine(value);
  const base = String(terms ?? '').trim();
  if (!base) return depositLine;

  if (DEPOSIT_TERMS_LINE_PATTERN.test(base)) {
    return base.replace(DEPOSIT_TERMS_LINE_PATTERN, depositLine);
  }

  const lines = base
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return depositLine;
  lines.splice(Math.min(1, lines.length), 0, depositLine);
  return lines.join('\n');
}

export function buildDefaultQuoteTerms(depositPercent = 50): string {
  return `This quote is valid for 30 days from the issue date.
${depositTermsLine(depositPercent)}
Lead times will be confirmed once the deposit is received.`;
}

export const DEFAULT_QUOTE_TERMS = buildDefaultQuoteTerms(50);
