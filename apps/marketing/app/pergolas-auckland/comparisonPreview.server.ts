import 'server-only';

/** Explicit opt-in for the protected comparison deployment; public releases default to the accepted design. */
export function pergolaComparisonEnabled() {
  return process.env.MARKETING_PERGOLA_COMPARISON_PREVIEW === 'true';
}
