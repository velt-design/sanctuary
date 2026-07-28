import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { loadPublicQuoteByToken, type PublicQuote } from '@/lib/quotes/publicQuote';
import { formatQuoteIntroText, formatQuoteLineDescription, formatQuoteTermsText } from '@sp/quote-format';
import { QuoteTopBarActions } from './QuoteTopBarActions';
import styles from './quoteEditorial.module.css';

type QuotePageProps = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
};

type QuoteDisplayStatus = 'DRAFT' | 'SENT' | 'EXPIRED' | 'ACCEPTED' | 'DECLINED';
type QuoteAcceptAction = 'hidden' | 'enabled' | 'disabled';

type QuoteAttachment = {
  id: string;
  href: string;
  label: string;
};

type QuoteNoticeTone = 'error' | 'info' | 'muted';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const quantityFormatter = new Intl.NumberFormat('en-NZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

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

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return quantityFormatter.format(value);
}

function resolveDisplayStatus(status: PublicQuote['status'], isExpired: boolean): QuoteDisplayStatus {
  if (isExpired) return 'EXPIRED';
  if (status === 'ACCEPTED') return 'ACCEPTED';
  if (status === 'SENT') return 'SENT';
  if (status === 'DECLINED') return 'DECLINED';
  return 'DRAFT';
}

function resolveAcceptAction(status: QuoteDisplayStatus): QuoteAcceptAction {
  if (status === 'SENT') return 'enabled';
  if (status === 'EXPIRED') return 'disabled';
  return 'hidden';
}

function statusLabel(status: QuoteDisplayStatus): string {
  if (status === 'EXPIRED') return 'Quote expired';
  if (status === 'ACCEPTED') return 'Accepted';
  if (status === 'SENT') return 'Quote sent';
  if (status === 'DECLINED') return 'Declined';
  return 'Draft';
}

function statusClassName(status: QuoteDisplayStatus): string {
  if (status === 'EXPIRED') return styles.statusExpired;
  if (status === 'ACCEPTED') return styles.statusAccepted;
  if (status === 'SENT') return styles.statusSent;
  if (status === 'DECLINED') return styles.statusDeclined;
  return styles.statusDraft;
}

function unitPriceCents(line: PublicQuote['lineItems'][number]): number | null {
  if (!Number.isFinite(line.qty) || Math.abs(line.qty) < 0.000_001) return null;
  return Math.round(line.lineTotalIncGstCents / line.qty);
}

function errorText(code: string): string {
  switch (code) {
    case 'expired':
      return 'This quote link has expired.';
    case 'invalid_status':
      return 'This quote can no longer be accepted from this link.';
    case 'invalid':
      return 'This quote link is invalid.';
    default:
      return 'Unable to accept the quote. Please contact Sanctuary Pergolas.';
  }
}

function QuoteViewerShell({ topBar, children }: { topBar?: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.shell}>
      {topBar ? <section className={styles.topBarWrap}>{topBar}</section> : null}
      <div className={styles.canvas}>{children}</div>
    </main>
  );
}

function QuoteTopBar({ status }: { status: QuoteDisplayStatus }) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <span className={styles.topBarContext}>Customer quote</span>
        <span className={`${styles.statusPill} ${statusClassName(status)}`}>{statusLabel(status)}</span>
      </div>
      <QuoteTopBarActions />
    </div>
  );
}

function QuoteDocumentCard({ children }: { children: ReactNode }) {
  return <article className={styles.documentCard}>{children}</article>;
}

function QuoteDocHeader({
  quoteRef,
  versionNumber,
  projectName,
}: {
  quoteRef: string;
  versionNumber: number;
  projectName: string;
}) {
  return (
    <header className={styles.docHeader}>
      <div>
        <p className={styles.docLabel}>Sanctuary customer quote</p>
        <h1 className={styles.docTitle}>{projectName || 'Your Sanctuary project'}</h1>
        <p className={styles.docQuoteRef}>
          {quoteRef} / V{versionNumber}
        </p>
      </div>
      <p className={styles.docWordmark}>Sanctuary Pergolas</p>
    </header>
  );
}

function QuoteMetaGrid({ quote, status }: { quote: PublicQuote; status: QuoteDisplayStatus }) {
  const fields = [
    { label: 'Prepared for', value: quote.customerName || 'Customer' },
    { label: 'Site', value: quote.projectAddress || 'Not provided' },
    { label: 'Quote number', value: `${quote.quoteRef} v${quote.versionNumber}` },
    { label: 'Issued', value: formatDate(quote.createdAt) },
    { label: 'Valid until', value: formatDate(quote.expiresAt) },
    { label: 'Status', value: statusLabel(status) },
  ];

  return (
    <section className={styles.metaSection} aria-label="Quote details">
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

function QuoteLineItemsTable({ lineItems }: { lineItems: PublicQuote['lineItems'] }) {
  return (
    <section className={styles.tableSection} aria-label="Quote line items">
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
          {lineItems.length ? (
            lineItems.map((line, index) => {
              const unitCents = unitPriceCents(line);
              const description = formatQuoteLineDescription(line.description, index);
              return (
                <tr key={line.id}>
                  <td>
                    <strong className={styles.descriptionHeading}>{description.heading || 'Line item:'}</strong>
                    {description.bullets.length ? (
                      <ul className={styles.descriptionBullets}>
                        {description.bullets.map((bullet, bulletIndex) => (
                          <li key={`${line.id}:${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className={styles.numericCell} data-label="Quantity">{formatQty(line.qty)}</td>
                  <td className={styles.numericCell} data-label="Unit price">{unitCents == null ? '\u2014' : formatMoney(unitCents)}</td>
                  <td className={styles.numericCell} data-label="Amount">{formatMoney(line.lineTotalIncGstCents)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className={styles.emptyCell} colSpan={4}>
                No line items listed.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function QuoteIntro({ introText }: { introText?: string | null }) {
  const intro = formatQuoteIntroText(introText);
  if (!intro) return null;

  return (
    <section className={styles.introSection} aria-label="Quote introduction">
      <p className={styles.introText}>{intro}</p>
    </section>
  );
}

function QuoteTotals({ quote }: { quote: PublicQuote }) {
  const hasBreakdown = Number.isFinite(quote.totalExGstCents) && Number.isFinite(quote.gstCents);

  if (hasBreakdown) {
    return (
      <section className={styles.totalsSection} aria-label="Quote totals">
        <div className={styles.totalsBreakdown}>
          <div className={styles.totalsBreakdownRow}>
            <span className={styles.totalsBreakdownLabel}>SUBTOTAL NZD</span>
            <span className={styles.totalsBreakdownValue}>{formatMoney(quote.totalExGstCents ?? 0)}</span>
          </div>
          <div className={styles.totalsBreakdownRow}>
            <span className={styles.totalsBreakdownLabel}>INCLUDES GST 15%</span>
            <span className={styles.totalsBreakdownValue}>{formatMoney(quote.gstCents ?? 0)}</span>
          </div>
          <div className={`${styles.totalsBreakdownRow} ${styles.totalsBreakdownTotalRow}`}>
            <span className={styles.totalsBreakdownLabel}>TOTAL NZD</span>
            <span className={styles.totalsBreakdownTotalValue}>{formatMoney(quote.totalIncGstCents)}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.totalsSection} aria-label="Quote totals">
      <p className={styles.totalsHint}>Includes GST</p>
      <div className={styles.totalsRow}>
        <span className={styles.totalsLabel}>Total</span>
        <span className={styles.totalsValue}>{formatMoney(quote.totalIncGstCents)}</span>
      </div>
    </section>
  );
}

function QuoteTerms({ termsText, sentAt }: { termsText?: string | null; sentAt?: string | null }) {
  const terms = formatQuoteTermsText(termsText, { sentAt });
  if (!terms.length) return null;

  return (
    <section className={styles.termsSection} aria-label="Quote terms">
      <p className={styles.termsTitle}>TERMS</p>
      <ul className={styles.termsList}>
        {terms.map((term, index) => (
          <li key={`${index}:${term}`}>{term}</li>
        ))}
      </ul>
    </section>
  );
}

function QuoteNotice({ tone, children }: { tone: QuoteNoticeTone; children: ReactNode }) {
  const toneClass =
    tone === 'error' ? styles.noticeError : tone === 'info' ? styles.noticeInfo : styles.noticeMuted;
  return <div className={`${styles.notice} ${toneClass}`}>{children}</div>;
}

function QuotePrimaryAction({
  quoteId,
  token,
  action,
}: {
  quoteId: string;
  token: string;
  action: QuoteAcceptAction;
}) {
  if (action === 'hidden') return null;

  return (
    <div className={styles.acceptSection}>
      <div className={styles.acceptCopy}>
        <p>Ready to proceed?</p>
        <span>After acceptance, we will email your deposit invoice and payment details.</span>
      </div>
      <form action={`/api/quotes/${encodeURIComponent(quoteId)}/accept`} method="post">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={action !== 'enabled'}
          className={`${styles.acceptButton} ${action !== 'enabled' ? styles.acceptButtonDisabled : ''}`}
        >
          Accept quote
        </button>
      </form>
    </div>
  );
}

function QuoteAttachments({ attachments }: { attachments: QuoteAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <section className={styles.attachmentsSection} aria-label="Quote attachments">
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

function QuoteViewerError({ title, description }: { title: string; description: string }) {
  return (
    <QuoteViewerShell>
      <QuoteDocumentCard>
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorMessage}>{description}</p>
      </QuoteDocumentCard>
    </QuoteViewerShell>
  );
}

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { quoteId } = await params;
  const qs = await searchParams;

  const token = readQueryString(qs.token);
  const acceptErrorCode = readQueryString(qs.error);

  if (!token) {
    return <QuoteViewerError title="Missing token" description="This quote link is missing its access token." />;
  }

  const lookup = await loadPublicQuoteByToken({ quoteId, token });
  const quote = lookup.quote;

  if (!quote) {
    return (
      <QuoteViewerError
        title="Quote unavailable"
        description="This quote link is invalid or has expired. Please contact Sanctuary Pergolas for a refreshed link."
      />
    );
  }

  const isExpired = lookup.reason === 'expired';
  const displayStatus = resolveDisplayStatus(quote.status, isExpired);
  const acceptAction = resolveAcceptAction(displayStatus);
  const attachments: QuoteAttachment[] = Array.isArray(quote.attachments)
    ? quote.attachments.map((attachment) => ({
        id: attachment.id,
        href: attachment.href,
        label: attachment.label,
      }))
    : [];

  return (
    <QuoteViewerShell topBar={<QuoteTopBar status={displayStatus} />}>
      <QuoteDocumentCard>
        <QuoteDocHeader
          quoteRef={quote.quoteRef}
          versionNumber={quote.versionNumber}
          projectName={quote.projectName}
        />
        <QuoteMetaGrid quote={quote} status={displayStatus} />
        <QuoteIntro introText={quote.introText} />
        <QuoteLineItemsTable lineItems={quote.lineItems} />
        <QuoteTotals quote={quote} />
        <QuoteTerms termsText={quote.termsText} sentAt={quote.sentAt} />
        <QuoteAttachments attachments={attachments} />
        <QuotePrimaryAction quoteId={quoteId} token={token} action={acceptAction} />

        {acceptErrorCode ? <QuoteNotice tone="error">{errorText(acceptErrorCode)}</QuoteNotice> : null}
        {displayStatus === 'EXPIRED' ? (
          <QuoteNotice tone="muted">
            This quote link has expired. Please contact Sanctuary Pergolas for a refreshed quote link.
          </QuoteNotice>
        ) : null}
        {displayStatus === 'ACCEPTED' ? (
          <QuoteNotice tone="info">Quote accepted. Your deposit invoice has been emailed to you.</QuoteNotice>
        ) : null}
      </QuoteDocumentCard>
    </QuoteViewerShell>
  );
}

