'use client';
import { useEffect, useState } from 'react';
import type { reviewInvoicePayments } from '@/lib/xero/invoicePaymentReview';
import PaymentHistory from './PaymentHistory';
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
    <PaymentHistory invoiceId={invoiceId} refreshKey={historyRevision} disabled={busy || Boolean(pendingId)}
      onCorrection={() => { setReview(null); setConfirmed(null); }} />
    <p>Review payments attached to this Xero invoice. Only your explicit approval records a payment in the portal.</p>
    <button disabled={busy || Boolean(pendingId)} onClick={load}>Refresh payment review</button>
    {message && <p role="status">{message}</p>}
    {pendingId && <p><button disabled={busy} onClick={status}>Check approval status</button>{' '}
      {uncertain && <button disabled={busy} onClick={() => approve(uncertain)}>Retry same approval</button>}{' '}
      {noResult && <button disabled={busy} onClick={() => { remember(null); setUncertain(null); void load(); }}>Start a fresh review</button>}</p>}
    {review && <>
      <h2>{review.invoice.invoiceRef} — {review.invoice.customerName}</h2>
      <p>Invoice amount: {money(review.invoice.totalIncGstCents)}. Evidence checked {new Date(review.checkedAt).toLocaleString('en-NZ')}.</p>
      {!review.suggestions.length && <p>No attached payments were returned by Xero.</p>}
      {review.suggestions.map(item => <article key={item.payment.id}>
        <h3>{item.amountCents === null ? 'Amount needs review' : money(item.amountCents)} received {item.payment.date || 'on an unverified date'}</h3>
        <p>Customer: {item.payment.contact}. Reference: {item.payment.reference || 'Not supplied'}.</p>
        {item.blockers.length > 0 ? <ul>{item.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul> : <>
          <p>Still owing after approval: {money(item.remainingIfApprovedCents!)}.</p>
          <label><input type="checkbox" disabled={busy || Boolean(pendingId)} checked={confirmed === item.payment.id}
            onChange={event => setConfirmed(event.target.checked ? item.payment.id : null)} /> I have checked this payment belongs to this invoice.</label>{' '}
          <button disabled={busy || Boolean(pendingId) || confirmed !== item.payment.id} onClick={() => approve(item)}>Approve payment</button>
        </>}
      </article>)}
    </>}
  </section>;
}
