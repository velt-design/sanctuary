'use client';
import { useRef, useState, type FormEvent } from 'react';
import type { MatchInvoice, PaymentSuggestion } from '@/lib/xero/paymentSuggestions';

type ReviewResult = { invoice: MatchInvoice; suggestions: PaymentSuggestion[]; checkedAt: string; limited: boolean; note: string };
const money = (cents: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);

export default function PaymentSuggestions() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    busy.current = true; setPending(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/integrations/xero/payment-suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceRef: data.get('invoiceRef'), contactName: data.get('contactName') }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Review unavailable');
      setResult(body);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Review unavailable. Nothing was changed.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <section aria-labelledby="deposit-matching-title" style={{ marginTop: 32 }}>
    <h2 id="deposit-matching-title">Review a deposit match</h2>
    <p>Any verified deposit counts as a customer win. Paying the full requested deposit is a separate milestone.</p>
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end' }}>
      <label>Portal invoice number<br /><input name="invoiceRef" placeholder="INV-0033" required pattern="INV-[0-9]{1,12}" disabled={pending} /></label>
      <label>Xero contact name (optional)<br /><input name="contactName" placeholder="Use invoice customer name" maxLength={240} disabled={pending} /></label>
      <button disabled={pending} style={{ minHeight: 44 }}>{pending ? 'Comparing records…' : 'Find suggested matches'}</button>
    </form>
    {pending && <p role="status">Reading the portal invoice, payment history and Xero receipts…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div aria-live="polite">
      <h3>{result.invoice.projectName || result.invoice.customerName} — {result.invoice.invoiceRef}</h3>
      <p>Portal invoice: {result.invoice.status}. Requested deposit: {money(result.invoice.totalIncGstCents)}.</p>
      <a href={`/staff/projects/${result.invoice.projectId}?tab=invoices`}>Open project invoices and payment history</a>
      <p>{result.note}</p>
      <p>Checked {new Date(result.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} (New Zealand time).</p>
      {result.limited && <p role="alert">Only the first 20 receipts are shown. This search is incomplete.</p>}
      {!result.suggestions.length && <p>No receipts found under this contact name. This does not prove the customer has not paid; try their exact Xero contact name or check Xero directly.</p>}
      {result.suggestions.map((item, index) => <article key={item.receipt.id} style={{ border: '1px solid currentColor', padding: 16, marginTop: 16, overflowWrap: 'anywhere' }}>
        <h4>Receipt {index + 1}: {item.receipt.contact} — {item.amountCents === null ? 'Amount unavailable' : `${item.receipt.currency} ${(item.amountCents / 100).toFixed(2)}`}</h4>
        <p>{item.receipt.date.slice(0, 10)} · {item.receipt.status} · Reconciled: {item.receipt.reconciled === true ? 'Yes' : item.receipt.reconciled === false ? 'No' : 'Unknown'}</p>
        <p>Reference: {item.receipt.reference || 'Not supplied by Xero'}. Receipt ID: {item.receipt.id}</p>
        <ul>{item.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        {item.blockers.length > 0 ? <><strong>Resolve before approval</strong><ul>{item.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></> : <>
          <strong>Suggested match — awaiting your review</strong>
          <p>If confirmed as this project’s deposit: customer won; remaining requested deposit {money(item.depositRemainingIfApprovedCents!)}.</p>
        </>}
      </article>)}
    </div>}
  </section>;
}
