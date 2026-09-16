import type { ProjectInvoiceSchedule } from "@/lib/invoices/types";
import { formatPortalDateTime } from "@/lib/format/portalDateTime";
import { AlertBanner, ButtonLink, Card, KeyValueGrid } from "@/components/ui/foundation";
import styles from "./ProjectPaymentPosition.module.css";

const money = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" });

/** Uses the invoice ledger totals verbatim; a payment is not proof of installation readiness. */
export default function ProjectPaymentPosition({
  projectId,
  schedule,
  saved = false,
  loadedAt,
}: {
  projectId: string;
  schedule: ProjectInvoiceSchedule;
  saved?: boolean;
  loadedAt?: string;
}) {
  const hasAgreement = Boolean(schedule.acceptedQuoteVersionId || schedule.acceptedQuotes?.length);
  return (
    <Card title="Payment position" padding="compact" aria-label="Payment position">
      <div className={styles.stack}>
        {saved ? <AlertBanner tone="warning" title="Saved payment position">The latest payment refresh failed. Check Invoices before acting.</AlertBanner> : null}
        <KeyValueGrid columns={2} items={[
          { label: "Recorded payments", value: money.format(schedule.paidIncGstCents / 100) },
          { label: "Open invoice balance", value: money.format(schedule.outstandingIncGstCents / 100) },
          { label: "Still to invoice", value: money.format(schedule.remainingToInvoiceIncGstCents / 100) },
          { label: "Accepted agreement", value: hasAgreement ? money.format(schedule.acceptedQuoteTotalIncGstCents / 100) : "Not recorded" },
        ]} />
        <p className={styles.context}>NZD inc GST · recorded in the project ledger. This is not a live bank balance. An open invoice balance of $0 does not mean the whole job is paid.</p>
        {loadedAt ? <p className={styles.context}>Ledger loaded {formatPortalDateTime(loadedAt)}</p> : null}
        {schedule.unallocatedCreditIncGstCents > 0 || schedule.overCommittedIncGstCents > 0 ? (
          <AlertBanner tone="warning" title="Payment allocation needs review">Open Invoices to review unallocated credit or amounts above the agreed total.</AlertBanner>
        ) : null}
        <ButtonLink variant="tertiary" size="small" href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}>View invoices and payment evidence</ButtonLink>
      </div>
    </Card>
  );
}
