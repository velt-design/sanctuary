'use client';
import { useRef, useState, type FormEvent } from 'react';
import type { XeroFinanceContact, XeroRevenueAccount, XeroRevenueTax } from '@/lib/xero/financeMappingProvider';
type Review = { context: { sourceContactId: string; invoiceRef: string; customerName: string }; contacts: XeroFinanceContact[];
  accounts: XeroRevenueAccount[]; taxes: XeroRevenueTax[]; limited: boolean; checkedAt: string };
export default function MappingReview({ invoiceId }: { invoiceId: string }) {
  const [review, setReview] = useState<Review | null>(null); const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false); const busy = useRef(false);
  const attempt = useRef<{ selection: string; commandId: string } | null>(null);
  async function command(body: object) {
    const response = await fetch('/api/payments/xero/mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Could not confirm the mapping.'); return data;
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return; busy.current = true; setPending(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm the mapping.'); }
    finally { busy.current = false; setPending(false); }
  }
  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = String(new FormData(event.currentTarget).get('contactName') ?? '').trim();
    void run(async () => { setReview(null); setReview(await command({ action: 'inspect', invoiceId, ...(name ? { contactName: name } : {}) })); });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!review) return;
    const data = new FormData(event.currentTarget); if (data.get('confirmed') !== 'on') return;
    const selection = { invoiceId, sourceContactId: review.context.sourceContactId, contactId: data.get('contactId'), accountCode: data.get('accountCode'), taxType: data.get('taxType') };
    const key = JSON.stringify(selection);
    if (attempt.current?.selection !== key) attempt.current = { selection: key, commandId: crypto.randomUUID() };
    const commandId = attempt.current.commandId;
    void run(async () => { await command({ action: 'confirm', ...selection, commandId, confirmed: true });
      setMessage('Mapping saved. No invoice was posted or payment approved. Transfer activation and any stopped transfer still require a separate check.'); });
  }
  return <div>
    <form onSubmit={inspect}><label>Xero customer name, if different <input name="contactName" maxLength={240} /></label>{' '}
      <button disabled={pending}>Check Xero records</button></form>
    {message && <p role="status">{message}</p>}
    {review && <section><h2>{review.context.invoiceRef} — {review.context.customerName}</h2>
      <p>Compare the customer identity before saving. Matching names alone do not prove they are the same customer.</p>
      {review.limited && <p>More customer results exist. Refine the exact Xero name before choosing.</p>}
      {!review.contacts.length && <p>No active Xero customer matched. Check the name or create the customer in Xero before continuing.</p>}
      <form onSubmit={save} key={review.checkedAt} style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <label>Xero customer <select name="contactId" required defaultValue=""><option value="" disabled>Select customer</option>{review.contacts.map(item => <option key={item.id} value={item.id}>{item.name}{item.email ? ` — ${item.email}` : ''}</option>)}</select></label>
        <label>Sales account <select name="accountCode" required defaultValue=""><option value="" disabled>Select sales account</option>{review.accounts.map(item => <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}</select></label>
        <label>Sales tax <select name="taxType" required defaultValue=""><option value="" disabled>Select tax</option>{review.taxes.map(item => <option key={item.type} value={item.type}>{item.name} — {item.effectiveRate}%</option>)}</select></label>
        <label><input type="checkbox" name="confirmed" required /> I checked the customer identity and approve this sales account and tax as the defaults for future portal invoice transfers.</label>
        <button disabled={pending || review.limited || !review.contacts.length}>Save verified mapping</button>
      </form>
    </section>}
  </div>;
}
