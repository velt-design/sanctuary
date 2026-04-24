'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Quote } from '@/lib/types/quote';
import { quoteCustomerTotalIncGst, quoteLabel, quoteStatusLabel } from '@/lib/types/quote';
import { formatPortalDate } from '@/lib/format/portalDateTime';
import { getQuote } from '@/lib/repo/quotesRepo';
import styles from '../../../../projects.module.css';

function formatMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export default function QuotePrintView({ projectId, quoteId }: { projectId: string; quoteId: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    void (async () => {
      setQuote(await getQuote(quoteId));
    })();
  }, [quoteId]);

  const title = useMemo(() => (quote ? quoteLabel(quote) : 'Quote'), [quote]);

  useEffect(() => {
    if (!quote) return;
    document.title = `${quote.projectSnapshot.projectName || 'Project'} – ${quoteLabel(quote)}`;
  }, [quote]);

  if (!quote) {
    return (
      <main className={styles.page}>
        <p className={styles.note}>Quote not found.</p>
      </main>
    );
  }

  const content = quote.content ?? {};
  const pricing = quote.pricingSnapshot;
  const customerTotalInc = quoteCustomerTotalIncGst(quote);
  const showEstimateTotals = Math.abs(customerTotalInc - pricing.totalIncGst) > 0.009;
  const notes = typeof quote.notes === 'string' ? quote.notes.trim() : '';
  const modulesSummary = Array.isArray(quote.estimateSnapshot.modulesSummary) ? quote.estimateSnapshot.modulesSummary : [];

  return (
    <main className={styles.page} aria-label="Quote print view">
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => window.print()}
          style={{ marginBottom: 12 }}
        >
          Print / Save PDF
        </button>
      </div>

      <section className={styles.section} aria-label="Quote header">
        <div className={styles.sectionBody}>
          <h1 className={styles.title} style={{ fontSize: 20, marginBottom: 6 }}>
            {content.heading?.trim() ? content.heading : title}
          </h1>
          <p className={styles.subtitle} style={{ marginTop: 0 }}>
            {quoteStatusLabel(quote.status)} · {formatPortalDate(quote.createdAt)} · {quoteLabel(quote)}
          </p>
        </div>
      </section>

      <section className={styles.section} aria-label="Parties" style={{ marginTop: 14 }}>
        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Customer</label>
              <div>
                <div style={{ fontWeight: 700 }}>{quote.contactSnapshot.name}</div>
                <div className={styles.muted}>{quote.contactSnapshot.email}</div>
                {quote.contactSnapshot.phone ? <div className={styles.muted}>{quote.contactSnapshot.phone}</div> : null}
              </div>
            </div>
            <div className={styles.field}>
              <label>Project</label>
              <div>
                <div style={{ fontWeight: 700 }}>{quote.projectSnapshot.projectName || '—'}</div>
                {quote.projectSnapshot.siteAddress ? <div className={styles.muted}>{quote.projectSnapshot.siteAddress}</div> : null}
                {quote.projectSnapshot.region ? <div className={styles.muted}>{quote.projectSnapshot.region}</div> : null}
                {quote.projectSnapshot.quoteRef ? <div className={styles.muted}>Ref: {quote.projectSnapshot.quoteRef}</div> : null}
              </div>
            </div>
            <div className={styles.field}>
              <label>Pricing (NZD)</label>
              <div>
                <div style={{ fontWeight: 700 }}>Total (inc‑GST): {formatMoney(customerTotalInc)}</div>
                {showEstimateTotals ? (
                  <>
                    <div className={styles.muted}>Estimate total (inc‑GST): {formatMoney(pricing.totalIncGst)}</div>
                    <div className={styles.muted}>Estimate total (ex‑GST): {formatMoney(pricing.totalExGst)}</div>
                    <div className={styles.muted}>Estimate GST: {formatMoney(pricing.gstAmount)}</div>
                  </>
                ) : (
                  <>
                    <div className={styles.muted}>Total (ex‑GST): {formatMoney(pricing.totalExGst)}</div>
                    <div className={styles.muted}>GST: {formatMoney(pricing.gstAmount)}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {modulesSummary.length ? (
        <section className={styles.section} aria-label="Estimate summary" style={{ marginTop: 14 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Estimate summary</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.muted} style={{ marginBottom: 8 }}>
              {quote.estimateSnapshot.summaryText}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {modulesSummary.map((line, idx) => (
                <div key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {notes ? (
        <section className={styles.section} aria-label="Notes" style={{ marginTop: 14 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Notes</h2>
          </div>
          <div className={styles.sectionBody}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{notes}</div>
          </div>
        </section>
      ) : null}

      {[
        { key: 'intro', label: 'Intro' },
        { key: 'scope', label: 'Scope' },
        { key: 'inclusions', label: 'Inclusions' },
        { key: 'exclusions', label: 'Exclusions' },
        { key: 'assumptions', label: 'Assumptions' },
        { key: 'terms', label: 'Terms' },
      ].map((section) => {
        const value = String((content as any)[section.key] ?? '').trim();
        if (!value) return null;
        return (
          <section key={section.key} className={styles.section} aria-label={section.label} style={{ marginTop: 14 }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{section.label}</h2>
            </div>
            <div className={styles.sectionBody}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value}</div>
            </div>
          </section>
        );
      })}

      <section className={styles.section} aria-label="Footer" style={{ marginTop: 14 }}>
        <div className={styles.sectionBody}>
          <div className={styles.muted}>
            Generated from estimate {quote.sourceEstimateId} · {quote.estimateSnapshot.summaryText}
          </div>
        </div>
      </section>
    </main>
  );
}
