import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  loadPublicDepositInvoiceByToken,
  type PublicDepositInvoice,
} from '@/lib/invoices/publicInvoice';
import styles from '../../quote/[quoteId]/quoteViewer.module.css';

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

type InvoiceDisplayStatus = 'OPEN' | 'EXPIRED';

type InvoiceAttachment = {
  id: string;
  href: string;
  label: string;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function readQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  if (typeof value === 'string') return value.trim();
  return '';
}

function formatMoney(cents: number): string {
  const dollars = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.max(0, Math.min(100, value)).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}%`;
}

function resolveDisplayStatus(isExpired: boolean): InvoiceDisplayStatus {
  return isExpired ? 'EXPIRED' : 'OPEN';
}

function statusLabel(status: InvoiceDisplayStatus): string {
  return status === 'EXPIRED' ? 'Invoice expired' : 'Invoice open';
}

function statusClassName(status: InvoiceDisplayStatus): string {
  return status === 'EXPIRED' ? styles.statusExpired : styles.statusSent;
}

function parsePaymentLines(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function InvoiceViewerShell({ topBar, children }: { topBar?: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.shell}>
      {topBar ? <section className={styles.topBarWrap}>{topBar}</section> : null}
      <div className={styles.canvas}>{children}</div>
    </main>
  );
}

function InvoiceTopBarActions({ pdfHref }: { pdfHref: string | null }) {
  return (
    <div className={styles.topBarActions}>
      <Link href="/contact" className={styles.topBarButton}>
        Contact Sanctuary
      </Link>
      {pdfHref ? (
        <a href={pdfHref} className={styles.topBarButton}>
          Download PDF
        </a>
      ) : (
        <span className={styles.topBarButton}>PDF unavailable</span>
      )}
    </div>
  );
}

function InvoiceTopBar({ status, totalIncGstCents, pdfHref }: { status: InvoiceDisplayStatus; totalIncGstCents: number; pdfHref: string | null }) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <span className={`${styles.statusPill} ${statusClassName(status)}`}>{statusLabel(status)}</span>
        <div className={styles.topBarTotal}>
          <div className={styles.topBarTotalLabel}>Amount due</div>
          <div className={styles.topBarTotalValue}>{formatMoney(totalIncGstCents)}</div>
        </div>
      </div>
      <InvoiceTopBarActions pdfHref={pdfHref} />
    </div>
  );
}

function InvoiceDocumentCard({ children }: { children: ReactNode }) {
  return <article className={styles.documentCard}>{children}</article>;
}

function InvoiceDocHeader({ invoiceRef }: { invoiceRef: string }) {
  return (
    <header className={styles.docHeader}>
      <div>
        <p className={styles.docLabel}>Invoice</p>
        <p className={styles.docQuoteRef}>{invoiceRef}</p>
      </div>
      <p className={styles.docWordmark}>Sanctuary Pergolas</p>
    </header>
  );
}

function InvoiceMetaGrid({ invoice, status }: { invoice: PublicDepositInvoice; status: InvoiceDisplayStatus }) {
  const fields = [
    { label: 'To', value: invoice.customerName || 'Customer' },
    { label: 'From', value: 'Sanctuary Pergolas' },
    { label: 'Invoice number', value: invoice.invoiceRef },
    { label: 'Quote', value: `${invoice.quoteRef} v${invoice.quoteVersionNumber}` },
    { label: 'Status', value: statusLabel(status) },
    { label: 'Issued', value: formatDate(invoice.issueDate) },
    { label: 'Due date', value: formatDate(invoice.dueDate) },
    { label: 'Site', value: invoice.projectAddress || 'Not provided' },
    { label: 'Currency', value: 'NZD' },
  ];

  return (
    <section className={styles.metaSection} aria-label="Invoice details">
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

function InvoiceLineItemsTable({ invoice }: { invoice: PublicDepositInvoice }) {
  const description = `Deposit for quote ${invoice.quoteRef} v${invoice.quoteVersionNumber} (${formatPercent(invoice.depositPercent)})`;
  return (
    <section className={styles.tableSection} aria-label="Invoice line items">
      <table className={styles.lineItemsTable}>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className={styles.numericCell}>
              Qty
            </th>
            <th scope="col" className={styles.numericCell}>
              Unit price
            </th>
            <th scope="col" className={styles.numericCell}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{description}</td>
            <td className={styles.numericCell}>1</td>
            <td className={styles.numericCell}>{formatMoney(invoice.totalIncGstCents)}</td>
            <td className={styles.numericCell}>{formatMoney(invoice.totalIncGstCents)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function InvoiceTotals({ invoice }: { invoice: PublicDepositInvoice }) {
  return (
    <section className={styles.totalsSection} aria-label="Invoice totals">
      <div className={styles.totalsBreakdown}>
        <div className={styles.totalsBreakdownRow}>
          <span className={styles.totalsBreakdownLabel}>SOURCE QUOTE TOTAL NZD</span>
          <span className={styles.totalsBreakdownValue}>{formatMoney(invoice.quoteTotalIncGstCents)}</span>
        </div>
        <div className={styles.totalsBreakdownRow}>
          <span className={styles.totalsBreakdownLabel}>SUBTOTAL NZD</span>
          <span className={styles.totalsBreakdownValue}>{formatMoney(invoice.totalExGstCents)}</span>
        </div>
        <div className={styles.totalsBreakdownRow}>
          <span className={styles.totalsBreakdownLabel}>INCLUDES GST 15%</span>
          <span className={styles.totalsBreakdownValue}>{formatMoney(invoice.gstCents)}</span>
        </div>
        <div className={`${styles.totalsBreakdownRow} ${styles.totalsBreakdownTotalRow}`}>
          <span className={styles.totalsBreakdownLabel}>AMOUNT DUE NZD</span>
          <span className={styles.totalsBreakdownTotalValue}>{formatMoney(invoice.totalIncGstCents)}</span>
        </div>
      </div>
    </section>
  );
}

function InvoicePaymentInstructions({ paymentInstructions }: { paymentInstructions: string | null }) {
  const lines = parsePaymentLines(paymentInstructions);
  if (!lines.length) return null;

  return (
    <section className={styles.termsSection} aria-label="Payment instructions">
      <p className={styles.termsTitle}>PAYMENT INSTRUCTIONS</p>
      <ul className={styles.termsList}>
        {lines.map((line, index) => (
          <li key={`${index}:${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function InvoiceAttachments({ attachments }: { attachments: InvoiceAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <section className={styles.attachmentsSection} aria-label="Invoice attachments">
      <p className={styles.metaLabel}>Attachments</p>
      <ul className={styles.attachmentsList}>
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <a className={styles.attachmentLink} href={attachment.href}>
              {attachment.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InvoiceNotice({ tone, children }: { tone: 'error' | 'info' | 'muted'; children: ReactNode }) {
  const toneClass = tone === 'error' ? styles.noticeError : tone === 'info' ? styles.noticeInfo : styles.noticeMuted;
  return <div className={`${styles.notice} ${toneClass}`}>{children}</div>;
}

function InvoiceViewerError({ title, description }: { title: string; description: string }) {
  return (
    <InvoiceViewerShell>
      <InvoiceDocumentCard>
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorMessage}>{description}</p>
      </InvoiceDocumentCard>
    </InvoiceViewerShell>
  );
}

export default async function InvoicePage({ params, searchParams }: InvoicePageProps) {
  const { invoiceId } = await params;
  const qs = await searchParams;

  const token = readQueryString(qs.token);
  if (!token) {
    return <InvoiceViewerError title="Missing token" description="This invoice link is missing its access token." />;
  }

  const lookup = await loadPublicDepositInvoiceByToken({ invoiceId, token });
  const invoice = lookup.invoice;

  if (!invoice) {
    const description = lookup.reason === 'void'
      ? 'This invoice is no longer active. Please contact Sanctuary Pergolas if you need a replacement.'
      : 'This invoice link is invalid or has expired. Please contact Sanctuary Pergolas for a refreshed link.';
    return <InvoiceViewerError title="Invoice unavailable" description={description} />;
  }

  const isExpired = lookup.reason === 'expired';
  const displayStatus = resolveDisplayStatus(isExpired);
  const pdfHref = invoice.pdfFileId
    ? `/api/invoices/${encodeURIComponent(invoiceId)}/pdf?token=${encodeURIComponent(token)}`
    : null;

  const attachments: InvoiceAttachment[] = pdfHref
    ? [{ id: 'invoice-pdf', href: pdfHref, label: 'Invoice PDF' }]
    : [];

  return (
    <InvoiceViewerShell topBar={<InvoiceTopBar status={displayStatus} totalIncGstCents={invoice.totalIncGstCents} pdfHref={pdfHref} />}>
      <InvoiceDocumentCard>
        <InvoiceDocHeader invoiceRef={invoice.invoiceRef} />
        <InvoiceMetaGrid invoice={invoice} status={displayStatus} />
        <InvoiceLineItemsTable invoice={invoice} />
        <InvoiceTotals invoice={invoice} />
        <InvoicePaymentInstructions paymentInstructions={invoice.paymentInstructions} />
        <InvoiceAttachments attachments={attachments} />

        {displayStatus === 'EXPIRED' ? (
          <InvoiceNotice tone="muted">
            This invoice link has expired. Please contact Sanctuary Pergolas for an updated invoice link.
          </InvoiceNotice>
        ) : null}
        <InvoiceNotice tone="info">No online payment is required. Please pay by bank transfer using this invoice number as reference.</InvoiceNotice>
      </InvoiceDocumentCard>
    </InvoiceViewerShell>
  );
}
