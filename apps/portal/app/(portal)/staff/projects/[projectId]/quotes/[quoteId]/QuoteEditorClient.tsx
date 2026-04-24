'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, QuoteContent } from '@/lib/types/quote';
import { quoteCustomerTotalIncGst, quoteLabel, quoteStatusLabel } from '@/lib/types/quote';
import { deleteQuote, duplicateQuoteAsRevision, getQuote, markQuotePaid, markQuoteSent, quoteIsLocked, updateQuote } from '@/lib/repo/quotesRepo';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import MoreMenu from '@/components/portal/MoreMenu';
import styles from '../../../projects.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import Modal from '@/components/ui/modal/Modal';

function formatMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

type ConfirmState =
  | { kind: 'delete' }
  | { kind: 'sent' }
  | { kind: 'paid' }
  | { kind: 'duplicate' }
  | null;

export default function QuoteEditorClient({
  projectId,
  quoteId,
  isAdmin,
}: {
  projectId: string;
  quoteId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [content, setContent] = useState<QuoteContent>({});
  const [dirty, setDirty] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [customerTotalOverride, setCustomerTotalOverride] = useState('');
  const [notes, setNotes] = useState('');
  const firstFieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void (async () => {
      const q = await getQuote(quoteId);
      setQuote(q);
      setContent(q?.content ?? {});
      setQuoteNumber(q?.quoteNumber ?? '');
      setCustomerTotalOverride(
        typeof q?.customerTotalOverride === 'number' && Number.isFinite(q.customerTotalOverride) ? q.customerTotalOverride.toFixed(2) : '',
      );
      setNotes(q?.notes ?? '');
      setDirty(false);
    })();
  }, [quoteId]);

  const locked = quote ? quoteIsLocked(quote) : true;

  useEffect(() => {
    if (!quote) return;
    if (locked) return;
    // Focus first field when opened in draft mode
    window.setTimeout(() => firstFieldRef.current?.focus(), 0);
  }, [quote?.id, locked]);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  if (!quote) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Quote"
          right={
            <HeaderActions>
              <Link className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(projectId)}`}>
                Project
              </Link>
            </HeaderActions>
          }
        />
        <p className={styles.note}>This quote doesn’t exist in the portal database.</p>
      </main>
    );
  }

  const title = quoteLabel(quote);
  const pricing = quote.pricingSnapshot;
  const effectiveTotalInc = (() => {
    const raw = customerTotalOverride.trim();
    const parsed = raw ? Number(raw.replace(/[^0-9.\\-]/g, '')) : NaN;
    return Number.isFinite(parsed) ? parsed : quoteCustomerTotalIncGst(quote);
  })();
  const pillClass =
    quote.status === 'paid'
      ? `${styles.statusPill} ${styles.statusPillPaid}`
      : quote.status === 'sent'
        ? `${styles.statusPill} ${styles.statusPillSent}`
        : `${styles.statusPill} ${styles.statusPillDraft}`;

  const save = async () => {
    if (locked) {
      toast.error('This quote is locked. Duplicate as a revision to edit.');
      return;
    }
    await run('save', () => {
      const totalRaw = customerTotalOverride.trim();
      const totalParsed = totalRaw ? Number(totalRaw.replace(/[^0-9.\\-]/g, '')) : NaN;
      const totalNext = Number.isFinite(totalParsed) ? totalParsed : quote.customerTotalOverride;
      return (async () => {
        const updated = await updateQuote(quote.id, {
          content,
          quoteNumber,
          customerTotalOverride: typeof totalNext === 'number' && Number.isFinite(totalNext) ? totalNext : null,
          notes: notes.trim() ? notes : null,
        });
        setQuote(updated);
        setDirty(false);
        toast.success('Quote saved.');
      })();
    });
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title={title}
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(projectId)}`}>
              Project
            </Link>
            <Link
              className={styles.button}
              href={`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quote.id)}/print`}
            >
              Print
            </Link>
            <MoreMenu
              items={[
                ...(quote.status === 'draft'
                  ? [
                      {
                        label: dirty ? 'Save' : 'Saved',
                        onClick: () => save(),
                        disabled: Boolean(busy) || !dirty,
                      },
                      {
                        label: 'Mark Sent',
                        onClick: () => setConfirm({ kind: 'sent' }),
                        disabled: Boolean(busy),
                      },
                    ]
                  : quote.status === 'sent'
                    ? [
                        {
                          label: 'Mark Paid',
                          onClick: () => setConfirm({ kind: 'paid' }),
                          disabled: Boolean(busy),
                        },
                      ]
                    : []),
                ...(quote.status !== 'draft'
                  ? [
                      {
                        label: 'Duplicate as Revision',
                        onClick: () => setConfirm({ kind: 'duplicate' }),
                        disabled: Boolean(busy),
                      },
                    ]
                  : []),
                ...(isAdmin
                  ? [
                      {
                        label: 'Delete Quote',
                        danger: true,
                        onClick: () => setConfirm({ kind: 'delete' }),
                        disabled: Boolean(busy),
                      },
                    ]
                  : []),
              ]}
              disabled={Boolean(busy)}
            />
          </HeaderActions>
        }
      />

      {locked ? (
        <div className={styles.section} aria-label="Locked notice" style={{ marginTop: 14 }}>
          <div className={styles.sectionBody}>
            <p className={styles.note} style={{ margin: 0 }}>
              This quote is <strong>{quoteStatusLabel(quote.status)}</strong> and locked to preserve auditability. Duplicate as a revision to make changes.
            </p>
          </div>
        </div>
      ) : null}

      <section className={styles.section} aria-label="Quote details" style={{ marginTop: 14 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <span className={pillClass}>{quoteStatusLabel(quote.status)}</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="quoteNumber">Quote number</label>
              <input
                id="quoteNumber"
                className={styles.inlineInput}
                value={quoteNumber}
                disabled={locked}
                onChange={(e) => {
                  setQuoteNumber(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="quoteTotal">Customer total (inc‑GST)</label>
              <input
                id="quoteTotal"
                className={styles.inlineInput}
                inputMode="decimal"
                value={customerTotalOverride}
                disabled={locked}
                onChange={(e) => {
                  setCustomerTotalOverride(e.target.value);
                  setDirty(true);
                }}
                placeholder={pricing.totalIncGst.toFixed(2)}
              />
              <div className={styles.muted} style={{ marginTop: 6 }}>
                Shown on the quote: <strong>{formatMoney(effectiveTotalInc)}</strong>
              </div>
            </div>
            <div className={styles.field}>
              <label>Customer</label>
              <div className={styles.muted}>
                <div>{quote.contactSnapshot.name}</div>
                <div>{quote.contactSnapshot.email}</div>
                {quote.contactSnapshot.phone ? <div>{quote.contactSnapshot.phone}</div> : null}
              </div>
            </div>
            <div className={styles.field}>
              <label>Project</label>
              <div className={styles.muted}>
                <div>{quote.projectSnapshot.projectName || '—'}</div>
                {quote.projectSnapshot.siteAddress ? <div>{quote.projectSnapshot.siteAddress}</div> : null}
                {quote.projectSnapshot.quoteRef ? <div>Ref: {quote.projectSnapshot.quoteRef}</div> : null}
              </div>
            </div>
            <div className={styles.field}>
              <label>Estimate totals</label>
              <div className={styles.muted}>
                <div>Ex‑GST: {formatMoney(pricing.totalExGst)}</div>
                <div>GST: {formatMoney(pricing.gstAmount)}</div>
                <div>Inc‑GST: {formatMoney(pricing.totalIncGst)}</div>
              </div>
            </div>
            <div className={styles.field}>
              <label>Derived from</label>
              <div className={styles.muted}>
                <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(quote.sourceEstimateId)}`}>
                  {quote.estimateSnapshot.summaryText}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Quote content" style={{ marginTop: 14 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Content</h2>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="q-heading">Heading</label>
              <input
                id="q-heading"
                className={styles.inlineInput}
                value={content.heading ?? ''}
                disabled={locked}
                onChange={(e) => {
                  setContent((prev) => ({ ...prev, heading: e.target.value }));
                  setDirty(true);
                }}
              />
            </div>
          </div>

          {[
            { key: 'intro' as const, label: 'Intro' },
            { key: 'scope' as const, label: 'Scope' },
            { key: 'inclusions' as const, label: 'Inclusions' },
            { key: 'exclusions' as const, label: 'Exclusions' },
            { key: 'assumptions' as const, label: 'Assumptions' },
            { key: 'terms' as const, label: 'Terms' },
          ].map((item, idx) => (
            <div key={item.key} className={styles.field} style={{ marginTop: 12 }}>
              <label htmlFor={`q-${item.key}`}>{item.label}</label>
              <textarea
                ref={idx === 0 ? firstFieldRef : undefined}
                id={`q-${item.key}`}
                value={(content as any)[item.key] ?? ''}
                disabled={locked}
                onChange={(e) => {
                  setContent((prev) => ({ ...prev, [item.key]: e.target.value }));
                  setDirty(true);
                }}
                rows={5}
                style={{
                  width: '100%',
                  margin: 0,
                  padding: '12px',
                  borderRadius: 12,
                  border: '1px solid rgba(var(--portal-text-rgb), 0.18)',
                  background: 'var(--portal-bg-surface)',
                  color: 'inherit',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>
          ))}

          <div className={styles.field} style={{ marginTop: 12 }}>
            <label htmlFor="q-notes">Notes (optional)</label>
            <textarea
              id="q-notes"
              value={notes}
              disabled={locked}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              rows={4}
              style={{
                width: '100%',
                margin: 0,
                padding: '12px',
                borderRadius: 12,
                border: '1px solid rgba(var(--portal-text-rgb), 0.18)',
                background: 'var(--portal-bg-surface)',
                color: 'inherit',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      </section>

      {confirm ? (
        <Modal
          open
          ariaLabel="Quote action confirmation"
          onClose={() => setConfirm(null)}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={520}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              {confirm.kind === 'delete'
                ? 'Delete quote?'
                : confirm.kind === 'duplicate'
                  ? 'Duplicate as revision?'
                  : confirm.kind === 'sent'
                    ? 'Mark sent?'
                    : 'Mark paid?'}
            </h2>
            <button type="button" className={styles.modalClose} onClick={() => setConfirm(null)}>
              Close
            </button>
          </div>
          <p className={styles.note}>
            {confirm.kind === 'delete'
              ? 'This removes the quote snapshot from the portal database.'
              : confirm.kind === 'duplicate'
                ? 'This will create a new draft revision you can edit.'
                : confirm.kind === 'sent'
                  ? 'This will lock the quote content and set the Sent date.'
                  : 'This will mark the quote as paid and set the Paid date.'}
          </p>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.buttonSecondary} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={confirm.kind === 'delete' ? styles.buttonDanger : styles.button}
              disabled={Boolean(busy)}
              onClick={() => {
                run('confirm', () => {
                  return (async () => {
                    if (confirm.kind === 'delete') {
                      setConfirm(null);
                      await deleteQuote(quote.id);
                      toast.success('Quote deleted.');
                      router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
                      return;
                    }

                    if (confirm.kind === 'duplicate') {
                      setConfirm(null);
                      const next = await duplicateQuoteAsRevision(quote.id);
                      toast.success(`Created ${quoteLabel(next)}.`);
                      router.push(`/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(next.id)}`);
                      return;
                    }

                    if (confirm.kind === 'sent') {
                      setConfirm(null);
                      const updated = await markQuoteSent(quote.id);
                      setQuote(updated);
                      toast.success('Quote marked sent.');
                      return;
                    }

                    if (confirm.kind === 'paid') {
                      setConfirm(null);
                      const updated = await markQuotePaid(quote.id);
                      setQuote(updated);
                      toast.success('Quote marked paid.');
                      return;
                    }
                  })();
                });
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
