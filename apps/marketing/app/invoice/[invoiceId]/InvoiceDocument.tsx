import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicDepositInvoice } from "@/lib/invoices/publicInvoice";
import styles from "./invoiceEditorial.module.css";

type InvoiceDocumentProps = {
  invoice: PublicDepositInvoice;
  pdfHref: string | null;
  quoteHref: string | null;
};

type DocumentActionProps = {
  href: string | null;
  label: string;
  unavailableLabel: string;
  description: string;
};

function formatMoney(cents: number): string {
  const dollars = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(parsed);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.max(0, Math.min(100, value))
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1")}%`;
}

function parsePaymentLines(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function InvoiceShell({
  topBar,
  children,
}: {
  topBar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={styles.shell}>
      {topBar ? (
        <section className={styles.topBarWrap}>{topBar}</section>
      ) : null}
      <div className={styles.canvas}>{children}</div>
    </main>
  );
}

function InvoiceTopBar({ invoice }: { invoice: PublicDepositInvoice }) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <span className={styles.topBarContext}>Customer invoice</span>
        <span className={styles.statusPill}>{invoice.status === "PAID" ? "Invoice paid" : "Invoice open"}</span>
      </div>
      <Link href="/contact" className={styles.topBarButton}>
        Contact Sanctuary
      </Link>
    </div>
  );
}

function InvoiceHeader({ invoice }: { invoice: PublicDepositInvoice }) {
  return (
    <header className={styles.docHeader}>
      <div>
        <p className={styles.docLabel}>Sanctuary invoice</p>
        <h1 className={styles.docTitle}>Invoice</h1>
        <p className={styles.docReference}>{invoice.invoiceRef}</p>
      </div>
      <p className={styles.docWordmark}>Sanctuary Pergolas</p>
    </header>
  );
}

function PaymentSummary({ invoice }: { invoice: PublicDepositInvoice }) {
  const fields = [
    {
      label: invoice.status === "PAID" ? "Amount paid" : "Amount due",
      value: formatMoney(invoice.totalIncGstCents),
      className: styles.summaryAmount,
    },
    {
      label: "Due date",
      value: formatDate(invoice.dueDate),
      className: styles.summaryValue,
    },
    {
      label: "Payment reference",
      value: invoice.invoiceRef,
      className: styles.summaryReference,
    },
  ];

  return (
    <section className={styles.summarySection} aria-label="Payment summary">
      <dl className={styles.summaryGrid}>
        {fields.map((field) => (
          <div key={field.label} className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>{field.label}</dt>
            <dd className={field.className}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InvoiceIntroduction({ invoice }: { invoice: PublicDepositInvoice }) {
  const projectName = invoice.projectName?.trim() || "your Sanctuary project";

  return (
    <section className={styles.introSection} aria-label="About this invoice">
      <p className={styles.introText}>
        This invoice is for <strong>{invoice.paymentTermLabel}</strong> ({invoice.paymentTermPosition} of {invoice.paymentTermCount}) on quote{" "}
        <strong>
          {invoice.quoteRef} v{invoice.quoteVersionNumber}
        </strong>{" "}
        for <strong>{projectName}</strong>.
      </p>
    </section>
  );
}

function InvoiceDetails({ invoice }: { invoice: PublicDepositInvoice }) {
  const fields = [
    { label: "Prepared for", value: invoice.customerName || "Customer" },
    {
      label: "Project",
      value: invoice.projectName || "Your Sanctuary project",
    },
    { label: "Site", value: invoice.projectAddress || "Not provided" },
    {
      label: "Related quote",
      value: `${invoice.quoteRef} v${invoice.quoteVersionNumber}`,
    },
    { label: "Issued", value: formatDate(invoice.issueDate) },
    {
      label: "Link available until",
      value: formatDate(invoice.tokenExpiresAt),
    },
  ];

  return (
    <section
      className={styles.metaSection}
      aria-labelledby="invoice-details-heading"
    >
      <div className={styles.sectionHeading}>
        <p className={styles.sectionEyebrow}>Context</p>
        <h2 id="invoice-details-heading" className={styles.sectionTitle}>
          Invoice details
        </h2>
      </div>
      <dl className={styles.metaGrid}>
        {fields.map((field) => (
          <div key={field.label} className={styles.metaItem}>
            <dt className={styles.metaLabel}>{field.label}</dt>
            <dd className={styles.metaValue}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InvoiceCalculation({ invoice }: { invoice: PublicDepositInvoice }) {
  const projectName = invoice.projectName?.trim() || "your Sanctuary project";

  return (
    <section
      className={styles.calculationSection}
      aria-labelledby="calculation-heading"
    >
      <div className={styles.sectionHeading}>
        <p className={styles.sectionEyebrow}>Calculation</p>
        <h2 id="calculation-heading" className={styles.sectionTitle}>
          Deposit amount
        </h2>
      </div>

      <div className={styles.tableFrame}>
        <table className={styles.lineItemsTable}>
          <caption className={styles.visuallyHidden}>
            Invoice calculation
          </caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className={styles.numericCell}>
                Deposit rate
              </th>
              <th scope="col" className={styles.numericCell}>
                Amount inc GST
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Description">
                <span className={styles.descriptionHeading}>
                  {invoice.paymentTermLabel} for {projectName}
                </span>
                <span className={styles.descriptionMeta}>
                  Quote {invoice.quoteRef} v{invoice.quoteVersionNumber}
                </span>
              </td>
              <td className={styles.numericCell} data-label="Payment stage">
                {invoice.paymentTermPosition} of {invoice.paymentTermCount}
              </td>
              <td className={styles.numericCell} data-label="Amount inc GST">
                {formatMoney(invoice.totalIncGstCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl className={styles.totalsBreakdown}>
        <div className={styles.totalsRow}>
          <dt>Source quote total</dt>
          <dd>{formatMoney(invoice.quoteTotalIncGstCents)}</dd>
        </div>
        <div className={styles.totalsRow}>
          <dt>Subtotal excluding GST</dt>
          <dd>{formatMoney(invoice.totalExGstCents)}</dd>
        </div>
        <div className={styles.totalsRow}>
          <dt>GST 15%</dt>
          <dd>{formatMoney(invoice.gstCents)}</dd>
        </div>
        <div className={`${styles.totalsRow} ${styles.totalsDueRow}`}>
          <dt>Amount due NZD</dt>
          <dd>{formatMoney(invoice.totalIncGstCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

function PaymentInstructions({ invoice }: { invoice: PublicDepositInvoice }) {
  const lines = parsePaymentLines(invoice.paymentInstructions);

  return (
    <section
      className={styles.paymentSection}
      aria-labelledby="payment-heading"
    >
      <div className={styles.paymentLead}>
        <p className={styles.sectionEyebrow}>Payment</p>
        <h2 id="payment-heading" className={styles.sectionTitle}>
          Bank transfer
        </h2>
        <p className={styles.paymentNote}>
          No online payment is required. Use the payment reference exactly as
          shown so we can match your payment.
        </p>
        <dl className={styles.paymentReference}>
          <dt>Payment reference</dt>
          <dd>{invoice.invoiceRef}</dd>
        </dl>
      </div>

      <div className={styles.paymentDetails}>
        <p className={styles.paymentDetailsLabel}>Transfer details</p>
        {lines.length ? (
          <ul className={styles.paymentLines}>
            {lines.map((line, index) => (
              <li key={`${index}:${line}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.paymentUnavailable}>
            Payment instructions are unavailable. Please contact Sanctuary
            before making payment.
          </p>
        )}
      </div>
    </section>
  );
}

function DocumentAction({
  href,
  label,
  unavailableLabel,
  description,
}: DocumentActionProps) {
  return (
    <div className={styles.documentAction}>
      <p className={styles.documentActionDescription}>{description}</p>
      {href ? (
        <a className={styles.documentActionLink} href={href}>
          {label}
        </a>
      ) : (
        <button
          type="button"
          className={styles.documentActionDisabled}
          disabled
        >
          {unavailableLabel}
        </button>
      )}
    </div>
  );
}

function InvoiceDocuments({
  pdfHref,
  quoteHref,
}: {
  pdfHref: string | null;
  quoteHref: string | null;
}) {
  return (
    <section
      className={styles.documentsSection}
      aria-labelledby="documents-heading"
    >
      <div className={styles.sectionHeading}>
        <p className={styles.sectionEyebrow}>Documents</p>
        <h2 id="documents-heading" className={styles.sectionTitle}>
          Download and review
        </h2>
      </div>
      <div className={styles.documentActions}>
        <DocumentAction
          href={pdfHref}
          label="Invoice PDF"
          unavailableLabel="Invoice PDF unavailable"
          description="Download a print-ready copy of this invoice."
        />
        <DocumentAction
          href={quoteHref}
          label="Source quote PDF"
          unavailableLabel="Source quote PDF unavailable"
          description="Review the accepted quote this invoice relates to."
        />
      </div>
    </section>
  );
}

function InvoiceHelp() {
  return (
    <section className={styles.helpSection} aria-labelledby="help-heading">
      <div>
        <p className={styles.sectionEyebrow}>Clarification</p>
        <h2 id="help-heading" className={styles.helpTitle}>
          Questions about this invoice?
        </h2>
        <p className={styles.helpText}>
          Contact Sanctuary before paying if any project, quote, amount or
          bank-transfer detail is unclear.
        </p>
      </div>
      <Link href="/contact" className={styles.primaryButton}>
        Contact Sanctuary
      </Link>
    </section>
  );
}

export function InvoiceDocument({
  invoice,
  pdfHref,
  quoteHref,
}: InvoiceDocumentProps) {
  return (
    <InvoiceShell topBar={<InvoiceTopBar invoice={invoice} />}>
      <article className={styles.documentCard}>
        <InvoiceHeader invoice={invoice} />
        <PaymentSummary invoice={invoice} />
        <InvoiceIntroduction invoice={invoice} />
        <InvoiceDetails invoice={invoice} />
        <InvoiceCalculation invoice={invoice} />
        <PaymentInstructions invoice={invoice} />
        <InvoiceDocuments pdfHref={pdfHref} quoteHref={quoteHref} />
        <InvoiceHelp />
      </article>
    </InvoiceShell>
  );
}

export function InvoiceUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <InvoiceShell>
      <article className={`${styles.documentCard} ${styles.errorCard}`}>
        <p className={styles.docWordmark}>Sanctuary Pergolas</p>
        <p className={styles.docLabel}>Customer invoice</p>
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorMessage}>{description}</p>
        <Link href="/contact" className={styles.primaryButton}>
          Contact Sanctuary
        </Link>
      </article>
    </InvoiceShell>
  );
}

export function InvoiceLoading() {
  return (
    <InvoiceShell>
      <article className={`${styles.documentCard} ${styles.errorCard}`}>
        <p className={styles.docWordmark}>Sanctuary Pergolas</p>
        <p className={styles.docLabel}>Customer invoice</p>
        <h1 className={styles.errorTitle}>Loading invoice</h1>
        <p className={styles.errorMessage} role="status" aria-live="polite">
          Checking this secure invoice link.
        </p>
      </article>
    </InvoiceShell>
  );
}
