/** Presentation only: exact calculator amounts remain in drafts and enquiries. */
export const roundedEstimate = (amount: number) => Math.round(amount / 5) * 5;
export const formatEstimate = (amount: number) => new Intl.NumberFormat('en-NZ', {
  style: 'currency', currency: 'NZD', maximumFractionDigits: 0,
}).format(roundedEstimate(amount));
