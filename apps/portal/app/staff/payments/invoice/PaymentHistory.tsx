'use client';
import { useEffect, useState } from 'react';
import type { loadInvoicePaymentHistory } from '@/lib/invoices/invoicePaymentHistory';
type History = Awaited<ReturnType<typeof loadInvoicePaymentHistory>>;
const money = (cents: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);
export default function PaymentHistory({ invoiceId, refreshKey, disabled, onCorrection }: {
  invoiceId: string; refreshKey: number; disabled: boolean; onCorrection: () => void;
}) {
  const [history, setHistory] = useState<History | null>(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setHistory(null);
    fetch('/api/payments/xero/invoice-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'history', invoiceId, offset }), signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setHistory(data); setMessage(''); } })
      .catch(() => { if (!controller.signal.aborted) setMessage('Payment history could not be loaded. Refresh to try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [invoiceId, offset, revision, refreshKey]);
  async function reverse() {
    if (!correcting || !confirmed || reason.trim().length < 3) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/payments/xero/invoice-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse', invoiceId, matchId: correcting, confirmed: true, reason: reason.trim() }) });
      if (!response.ok) throw new Error();
      setCorrecting(null); setReason(''); setConfirmed(false); onCorrection(); setRevision(value => value + 1);
    } catch { setMessage('The correction result could not be confirmed. Refresh history before retrying the same correction.'); }
    finally { setSaving(false); }
  }
  return <section aria-label="Portal payment history">
    <h2>Portal payment history</h2>
    <button disabled={loading || saving} onClick={() => setRevision(value => value + 1)}>Refresh payment history</button>
    {loading && <p>Loading recorded payments…</p>}{message && <p role="status">{message}</p>}
    {history && <>
      <p>Recorded against {history.invoice.invoiceRef}: {money(history.recordedCents)}. Invoice status: {history.invoice.status.toLowerCase()}.</p>
      {history.hasUnmatchedPaymentHistory && <p>Other project payment history needs reconciliation. This list shows Xero matches only. <a href={`/staff/projects/${history.invoice.projectId}`}>Open project</a></p>}
      {!history.matches.length && <p>No Xero matches are recorded on this page.</p>}
      {history.matches.map(match => <article key={match.id}>
        <h3>{money(match.amountCents)} — {match.reversedAt ? 'Reversed' : 'Recorded'}</h3>
        <p>Received {match.receiptDate}. {match.sourceKind === 'INVOICE_PAYMENT' ? 'Payment attached to Xero invoice' : 'Xero bank receipt'}.</p>
        <p>Approved by {match.approvedBy} on {new Date(match.approvedAt).toLocaleString('en-NZ')}.</p>
        {match.reference && <p>Reference: {match.reference}</p>}
        {match.reversedAt ? <p>Reversed by {match.reversedBy ?? 'finance'} on {new Date(match.reversedAt).toLocaleString('en-NZ')}: {match.reversalReason}</p> :
          <button disabled={disabled || saving} onClick={() => { setCorrecting(match.id); setReason(''); setConfirmed(false); }}>Correct this match</button>}
        {correcting === match.id && !match.reversedAt && <div>
          <p>This reverses the portal payment record and may reopen the invoice. It does not refund money or change Xero.</p>
          <label>Reason <textarea value={reason} maxLength={1000} disabled={saving} onChange={event => setReason(event.target.value)} /></label>
          <label><input type="checkbox" disabled={saving} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I confirm this portal match is incorrect.</label>
          <button disabled={disabled || saving || !confirmed || reason.trim().length < 3} onClick={reverse}>Reverse portal match</button>
          <button disabled={saving} onClick={() => setCorrecting(null)}>Cancel correction</button>
        </div>}
      </article>)}
      <nav aria-label="Payment history pages">
        {offset > 0 && <button disabled={loading || saving} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous payments</button>}
        {history.hasMore && offset < 10000 && <button disabled={loading || saving} onClick={() => setOffset(value => value + 50)}>More payments</button>}
      </nav>
    </>}
  </section>;
}
