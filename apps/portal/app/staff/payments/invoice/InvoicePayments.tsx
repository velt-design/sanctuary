'use client';
import { useEffect, useState } from 'react';
import type { reviewInvoicePayments } from '@/lib/xero/invoicePaymentReview';
import PaymentHistory from './PaymentHistory';
import PaymentSuggestion from './PaymentSuggestion';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import styles from './payments.module.css';
type Review = Awaited<ReturnType<typeof reviewInvoicePayments>>;
type Suggestion = Review['suggestions'][number];
const money = (cents: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);
export default function InvoicePayments({ invoiceId }: { invoiceId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<Suggestion | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [noResult, setNoResult] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const storageKey = `sanctuary.invoice-payment.pending:${invoiceId}`;
  useEffect(() => { try { setPendingId(sessionStorage.getItem(storageKey)); } catch { /* Keep in-memory recovery available. */ } }, [storageKey]);
  function remember(id: string | null) {
    setPendingId(id); setNoResult(false);
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* The current-page status check remains available. */ }
  }
  async function request(body: unknown) {
    const response = await fetch('/api/payments/xero/invoice-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'The result could not be confirmed.');
    return data;
  }
  async function load() {
    setBusy(true); setMessage(''); setConfirmed(null); setReview(null);
    try { setReview(await request({ action: 'review', invoiceId })); }
    catch { setMessage('Payment evidence could not be loaded. Try again.'); }
    finally { setBusy(false); }
  }
  async function approve(item: Suggestion) {
    setBusy(true); setMessage(''); setUncertain(item); remember(item.approvalId);
    try {
      await request({ action: 'approve', confirmed: true, approvalToken: item.approvalToken });
      setHistoryRevision(value => value + 1);
      setReview(null); setConfirmed(null); setUncertain(null); remember(null); setMessage('Payment recorded. Refresh the review to see the current balance.');
    } catch { setMessage('The result could not be confirmed. Check approval status before starting another review.'); }
    finally { setBusy(false); }
  }
  async function status() {
    if (!pendingId) return;
    setBusy(true);
    try {
      const data = await request({ action: 'status', approvalId: pendingId });
      if (data.match) {
        setHistoryRevision(value => value + 1);
        setMessage(data.match.reversedAt ? 'This payment approval was reversed. Review the history before proceeding.' : 'Payment was recorded successfully. Refresh the review for the current balance.');
        setUncertain(null); setReview(null); setConfirmed(null); remember(null);
      } else { setNoResult(true); setMessage('No completed approval was found. You can check again or start a fresh review; existing payments will be checked again.'); }
    } catch { setMessage('Approval status could not be checked. Do not record a manual duplicate.'); }
    finally { setBusy(false); }
  }
  return <section>
    <h2>Payments in Xero</h2>
    <p>Review payments attached to this Xero invoice. Only your explicit approval records a payment in the portal.</p>
    <Button variant="secondary" disabled={busy || Boolean(pendingId)} onClick={load}>Refresh payment review</Button>
    {busy && <p role="status">{pendingId ? 'Checking the payment approval result…' : 'Checking payment evidence…'}</p>}
    {message && <p role="status">{message}</p>}
    {pendingId && <p><Button variant="secondary" disabled={busy} onClick={status}>Check approval status</Button>{' '}
      {uncertain && <Button variant="secondary" disabled={busy} onClick={() => approve(uncertain)}>Retry same approval</Button>}{' '}
      {noResult && <Button variant="secondary" disabled={busy} onClick={() => { remember(null); setUncertain(null); void load(); }}>Start a fresh review</Button>}</p>}
    {review && <>
      <h2>{review.invoice.invoiceRef} — {review.invoice.customerName}</h2>
      <p>Invoice amount: {money(review.invoice.totalIncGstCents)}. Evidence checked {new Date(review.checkedAt).toLocaleString('en-NZ')}.</p>
      {!review.suggestions.length && <DataStatePanel state="empty" title="No payments attached in Xero" description="If the customer has paid, finance must reconcile the bank receipt to this invoice in Xero, then refresh this review." />}
      <div className={styles.list}>{review.suggestions.map(item => <PaymentSuggestion key={item.payment.id} item={item}
        disabled={busy || Boolean(pendingId)} confirmed={confirmed === item.payment.id}
        onConfirm={value => setConfirmed(value ? item.payment.id : null)} onApprove={() => void approve(item)} />)}</div>
    </>}
    <PaymentHistory invoiceId={invoiceId} refreshKey={historyRevision} disabled={busy || Boolean(pendingId)} onCorrection={() => { setReview(null); setConfirmed(null); }} />
  </section>;
}
