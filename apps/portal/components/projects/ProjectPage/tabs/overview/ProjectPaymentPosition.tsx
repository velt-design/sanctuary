import type { ReactNode } from "react";
import type { ProjectInvoiceSchedule } from "@/lib/invoices/types";
import { formatPortalDateTime } from "@/lib/format/portalDateTime";
import { AlertBanner, ButtonLink, Card, KeyValueGrid } from "@/components/ui/foundation";
import styles from "./ProjectPaymentPosition.module.css";
import { useProjectCommercialContext } from '../../ProjectCommercialContext';

const money = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" });

/** Uses the invoice ledger totals verbatim; a payment is not proof of installation readiness. */
export default function ProjectPaymentPosition({
  projectId,
  schedule,
  pending = false,
  statusPanel,
  saved = false,
  loadedAt,
  previewOnly = false,
}: {
  projectId: string;
  schedule: ProjectInvoiceSchedule | null;
  pending?: boolean;
  statusPanel?: ReactNode;
  saved?: boolean;
  loadedAt?: string;
  previewOnly?: boolean;
}) {
  const { closed } = useProjectCommercialContext();
  const hasAgreement = Boolean(schedule?.acceptedQuoteVersionId || schedule?.acceptedQuotes?.length);
  return (
    <Card title="Payment position" padding="compact" aria-label="Payment position">
      <div className={styles.stack}>
        {statusPanel}
        {saved ? <AlertBanner tone="warning" title="Saved payment position">The latest payment refresh failed. Check Invoices before acting.</AlertBanner> : null}
        <KeyValueGrid columns={2} items={[
          { label: "Recorded payments", value: schedule ? money.format(schedule.paidIncGstCents / 100) : pending ? "Reading payments" : "Unavailable" },
          { label: "Open invoice balance", value: schedule ? money.format(schedule.outstandingIncGstCents / 100) : pending ? "Reading balance" : "Unavailable" },
        ]} />
        <p className={styles.context}>{closed ? 'Closed project. Review invoices and payment history against the closure agreement; these figures do not establish what is still owed.' : 'NZD inc GST · project ledger. $0 open invoices does not mean paid in full.'}</p>
        {schedule && (schedule.unallocatedCreditIncGstCents > 0 || schedule.overCommittedIncGstCents > 0) ? (
          <AlertBanner tone="warning" title="Payment allocation needs review">Open Invoices to review unallocated credit or amounts above the agreed total.</AlertBanner>
        ) : null}
        <details className={styles.details}><summary>Payment breakdown</summary>
          <KeyValueGrid columns={2} items={[
            { label: closed ? "Uncovered contract value" : "Still to invoice", value: schedule ? money.format(schedule.remainingToInvoiceIncGstCents / 100) : pending ? "Reading agreement" : "Unavailable" },
            { label: "Accepted agreement", value: schedule ? hasAgreement ? money.format(schedule.acceptedQuoteTotalIncGstCents / 100) : "Not recorded" : pending ? "Reading agreement" : "Unavailable" },
          ]} />
          <p className={styles.context}>Recorded payments are not a live bank balance.</p>
          {loadedAt ? <p className={styles.context}>Ledger loaded {formatPortalDateTime(loadedAt)}</p> : null}
        </details>
        <ButtonLink disabled={previewOnly} variant="tertiary" size="small" href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}>Open invoices</ButtonLink>
      </div>
    </Card>
  );
}
