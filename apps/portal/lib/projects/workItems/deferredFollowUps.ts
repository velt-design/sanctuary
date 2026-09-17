// Owner decision, 17 September 2026: defer the unused email-recording workflow.
// Historical rows remain valid records, but are not actionable project work.
export function isDeferredProjectFollowUp(value: { sourceType?: string | null; sourceKey?: string | null }): boolean {
  return value.sourceType === 'LEAD_CADENCE' || value.sourceType === 'QUOTE_CADENCE'
    || /^(lead:|quote:follow-up:|quote:outcome-review:)/.test(value.sourceKey ?? '');
}
