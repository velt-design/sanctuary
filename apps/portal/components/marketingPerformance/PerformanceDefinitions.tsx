import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './MarketingPerformance.module.css';

export default function PerformanceDefinitions({ excludedTests, unlinked }: { excludedTests: number; unlinked: number }) {
  return <Card title="How to read this report" padding="compact">
    <p className={styles.muted}>{excludedTests} known labelled test submissions excluded in this date range. {unlinked} included enquiries have no linked project. Other tests or spam are not automatically classified; not-qualified and lost records remain included.</p>
    <details><summary>Definitions, denominators and historical limits</summary>
      <dl className={styles.definitions}>
        <dt>Enquiry cohort</dt><dd>One saved enquiry ID received in the date range. Retried submissions reuse their ID. Separate submissions remain separate enquiries; this is not a unique-person count. Manual projects without an enquiry receipt are outside the Enquiries view; Project portfolio includes them.</dd>
        <dt>Unique project outcomes</dt><dd>Only the earliest recorded enquiry per project credits visits, sent quotes, acceptance and wins. Repeat submissions can belong to a different source or period, but never earn the same project outcome again. Project rates divide by origin projects in this filtered cohort.</dd>
        <dt>Qualification</dt><dd>Latest explicit staff assessment under configured-enquiry-v1. Applies only to eligible configured residential enquiries. Qualification is not inferred from visits, budget, consent or stage. Eligible includes qualified, not qualified and unreviewed. Other enquiry types are outside these criteria.</dd>
        <dt>Visits and quotes</dt><dd>Visit means persisted confirmation, not attendance. Quotes sent counts projects with a sent or accepted version, excluding drafts. Accepted quotes counts projects with current accepted commercial scope, not quote versions; withdrawn acceptance is not current acceptance.</dd>
        <dt>Payment-verified projects</dt><dd>At least one unreversed verified Xero payment match, or a paid first-instalment invoice on current accepted scope. Matches can be partial deposits. A pipeline stage or accepted quote alone does not establish this payment evidence. Reversals can reduce current totals.</dd>
        <dt>Money and platform claims</dt><dd>Quoted value, accepted value and money received are different facts. Enquiries reports project outcome counts; Sales activity separately shows recorded payment-ledger entries, not revenue. Google and Meta claimed conversions and customer-reported discovery are not connected and are never added to verified totals.</dd>
        <dt>Attribution coverage</dt><dd>Enquiries with a consent-permitted recorded UTM source divided by all included enquiries in the current filter. Campaign-only records remain unknown source. Unknown includes historical gaps, expired context and denied consent; it does not mean direct traffic. Browser context lasts 30 minutes in a tab/session and does not capture earlier research visits. Saved source evidence is read without rewriting it.</dd>
        <dt>Costs</dt><dd>All cost figures are unavailable until spend is verified for the exact source, campaign, period, currency and tax basis. Proposed ratios are spend / qualified enquiries and spend / won projects. No denominator means unavailable, never zero cost.</dd>
      </dl>
    </details>
  </Card>;
}
