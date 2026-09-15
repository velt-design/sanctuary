'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import type { XeroFinanceContact, XeroRevenueAccount, XeroRevenueTax } from '@/lib/xero/financeMappingProvider';
import AccountingDefaults, { type AccountingDefaultsValue } from './AccountingDefaults';

type Review = { context: { sourceContactId: string; invoiceRef: string; customerName: string }; contacts: XeroFinanceContact[];
  accounts: XeroRevenueAccount[]; taxes: XeroRevenueTax[]; limited: boolean; checkedAt: string; customerCreationEnabled?: boolean;
  defaults: AccountingDefaultsValue; savedLink: { contactId: string; verifiedAt: string; contact: XeroFinanceContact | null } | null };
async function command(body: object, signal?: AbortSignal) {
  const response = await fetch('/api/payments/xero/mapping', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Could not confirm the mapping.'); return data;
}
export default function MappingReview({ invoiceId, initialContext }: { invoiceId: string; initialContext: Review['context'] }) {
  const [review, setReview] = useState<Review | null>(null); const [message, setMessage] = useState('');
  const [pending, setPending] = useState(true); const busy = useRef(false);
  const [saved, setSaved] = useState(false);
  const attempt = useRef<{ selection: string; commandId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    busy.current = true;
    setPending(true);
    void command({ action: 'inspect', invoiceId }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setReview(data); })
      .catch(() => { if (!controller.signal.aborted) setMessage('Xero details could not be loaded. Use Check Xero records to try again. Nothing has been changed.'); })
      .finally(() => { if (!controller.signal.aborted) { busy.current = false; setPending(false); } });
    return () => controller.abort();
  }, [invoiceId]);
  async function run(action: () => Promise<void>) {
    if (busy.current) return; busy.current = true; setPending(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm the mapping.'); }
    finally { busy.current = false; setPending(false); }
  }
  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = String(new FormData(event.currentTarget).get('contactName') ?? '').trim();
    void run(async () => { setSaved(false); setReview(null); setReview(await command({ action: 'inspect', invoiceId, ...(name ? { contactName: name } : {}) })); });
  }
  function save(kind: 'customer' | 'defaults', event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!review) return;
    const data = new FormData(event.currentTarget); if (data.get('confirmed') !== 'on') return;
    const selection = { invoiceId, sourceContactId: review.context.sourceContactId, ...(kind === 'customer' ? { action: 'confirmCustomer', contactId: data.get('contactId') } : { action: 'confirmDefaults', accountCode: data.get('accountCode'), taxType: data.get('taxType') }) };
    const key = JSON.stringify(selection);
    if (attempt.current?.selection !== key) attempt.current = { selection: key, commandId: crypto.randomUUID() };
    const commandId = attempt.current.commandId;
    void run(async () => { await command({ ...selection, commandId, confirmed: true });
      setSaved(true);
      setMessage(kind === 'customer' ? 'Customer link saved. Company accounting defaults are unchanged. No invoice was posted or payment approved.' : 'Company defaults saved for future transfers. Customer links and existing invoices are unchanged.');
      if (kind === 'defaults') { const tax = review.taxes.find(item => item.type === data.get('taxType')); if (tax) setReview({ ...review, defaults: { accountCode: String(data.get('accountCode')), taxType: tax.type, effectiveRate: tax.effectiveRate } }); } });
  }
  function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!review) return;
    const form = new FormData(event.currentTarget); if (form.get('confirmed') !== 'on') return;
    const name = String(form.get('name') ?? '').trim(); const current = review;
    void run(async () => {
      const response = await fetch('/api/payments/xero/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, sourceContactId: current.context.sourceContactId, name, confirmed: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'The customer result could not be verified. Retry with the same name.');
      setSaved(false); setReview({ ...current, contacts: [data.contact], checkedAt: new Date().toISOString() });
      setMessage('Xero customer verified. Confirm the customer link below. Company accounting defaults are handled separately.');
    });
  }
  return <div>
    <h2>{(review?.context ?? initialContext).invoiceRef} — {(review?.context ?? initialContext).customerName}</h2>
    <p>We check Xero for this customer automatically. Checking records does not save a link or change an invoice.</p>
    {pending && !review && <p role="status">Checking customer and accounting details in Xero…</p>}
    <form onSubmit={inspect}><label>Xero customer name, if different <Input name="contactName" maxLength={240} disabled={pending} /></label>{' '}
      <Button type="submit" variant="secondary" disabled={pending}>Check Xero records</Button></form>
    {message && <p role="status">{message}</p>}
    {saved && <button disabled={pending} onClick={() => void run(async () => {
      const result = await command({ action: 'resume', invoiceId, confirmed: true });
      setMessage(result.state === 'queued' ? 'The existing draft transfer is queued. Check finance review for its result.' : 'This transfer is already queued or running. Check finance review for its result.');
    })}>Resume existing draft transfer</button>}
    {review && <section>
      {!saved && (review.savedLink ? <AlertBanner tone={review.savedLink.contact ? 'info' : 'warning'} title={review.savedLink.contact ? 'Customer already linked to Xero' : 'Saved customer link needs checking'}>
        {review.savedLink.contact ? <p>{review.savedLink.contact.name}{review.savedLink.contact.email ? ` — ${review.savedLink.contact.email}` : ''}. The saved customer is selected below. Only change it if this is the wrong customer.</p>
          : <p>A customer link is saved, but Xero could not verify that record. Retry the check before replacing it or creating another customer.</p>}
      </AlertBanner> : <AlertBanner tone="info" title="Customer not yet linked"><p>Select the matching Xero customer below and confirm the details to save the link.</p></AlertBanner>)}
      <p>Compare the customer identity before saving. Matching names alone do not prove they are the same customer.</p>
      {review.limited && <p>More customer results exist. Refine the exact Xero name before choosing.</p>}
      {!review.contacts.length && <p>No active Xero customer matched. Check for another name before creating a new customer.</p>}
      {!review.contacts.length && !review.limited && review.customerCreationEnabled && <form onSubmit={createCustomer}>
        <label>New Xero customer name <input name="name" required maxLength={240} defaultValue={review.context.customerName} /></label>
        <p>This creates a customer record in Xero. It does not send an email or issue an invoice. If interrupted, retry with the same name.</p>
        <label><input type="checkbox" name="confirmed" required /> I checked for an existing Xero customer and want to create this customer.</label>{' '}
        <button disabled={pending}>Create Xero customer</button>
      </form>}
      <form onSubmit={event => save('customer', event)} key={review.checkedAt} style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <label>Xero customer<Select name="contactId" required defaultValue={review.savedLink?.contact?.id ?? ''}><option value="" disabled>Select customer</option>{review.contacts.map(item => <option key={item.id} value={item.id}>{item.name}{item.email ? ` — ${item.email}` : ''}</option>)}</Select></label>
        <label><input type="checkbox" name="confirmed" required /> I checked that this is the correct Xero customer.</label>
        <Button type="submit" disabled={pending || review.limited || !review.contacts.length}>Save customer link</Button>
      </form>
      <AccountingDefaults value={review.defaults} accounts={review.accounts} taxes={review.taxes} pending={pending} onSubmit={event => save('defaults', event)} />
    </section>}
  </div>;
}
