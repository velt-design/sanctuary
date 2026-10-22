'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import type { XeroFinanceContact, XeroRevenueAccount, XeroRevenueTax } from '@/lib/xero/financeMappingProvider';
import AccountingDefaults, { type AccountingDefaultsValue } from './AccountingDefaults';

export type MappingReviewEvidence = { context: { sourceContactId: string; invoiceRef: string; customerName: string }; contacts: XeroFinanceContact[];
  accounts: XeroRevenueAccount[]; taxes: XeroRevenueTax[]; limited: boolean; checkedAt: string; customerCreationEnabled?: boolean;
  defaults: AccountingDefaultsValue; savedLink: { contactId: string; verifiedAt: string; contact: XeroFinanceContact | null } | null };
async function command(body: object, signal?: AbortSignal) {
  const response = await fetch('/api/payments/xero/mapping', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Could not confirm the mapping.'); return data;
}
type InspectLoader=(body:object,signal?:AbortSignal)=>Promise<MappingReviewEvidence>;
const inspectMapping:InspectLoader=command;
type Props={readOnly?:boolean;inspectLoader?:InspectLoader;invoiceId:string;initialContext?:MappingReviewEvidence['context'];contextRead?:Promise<MappingReviewEvidence['context']|null>};
export default function MappingReview(props:Props){return <MappingReviewContent key={props.invoiceId} {...props}/>;}
function MappingReviewContent({ invoiceId, initialContext, contextRead, inspectLoader=inspectMapping,readOnly=false }: Props) {
  const [context,setContext]=useState(initialContext??null),[contextFailed,setContextFailed]=useState(false);
  const [review, setReview] = useState<MappingReviewEvidence | null>(null); const [message, setMessage] = useState('');
  const [pending, setPending] = useState(true); const busy = useRef(false);
  const [saved, setSaved] = useState(false);
  const [selectedContact,setSelectedContact]=useState(''),[contactConfirmed,setContactConfirmed]=useState(false);
  const [contactSource,setContactSource]=useState('');
  const nextContactSource=`${review?.checkedAt}:${review?.savedLink?.contact?.id}`;
  if(nextContactSource!==contactSource){setContactSource(nextContactSource);setSelectedContact(review?.savedLink?.contact?.id??'');setContactConfirmed(false);}
  const canResumeTransfer = saved && review?.savedLink?.contact && review.defaults
    && review.accounts.some(account => account.code === review.defaults?.accountCode)
    && review.taxes.some(tax => tax.type === review.defaults?.taxType && tax.effectiveRate === review.defaults.effectiveRate);
  const attempt = useRef<{ selection: string; commandId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    busy.current = true;
    setPending(true);
    let verifiedInvoice=false;
    void (async()=>{
      const verified=contextRead?await Promise.resolve(contextRead):initialContext??null;
      if(controller.signal.aborted)return;
      if(!verified){setContextFailed(true);setMessage('Invoice details could not be loaded. Return to finance review or retry this page. No Xero details have been changed.');return;}
      verifiedInvoice=true;setContext(verified);
      const data=await inspectLoader({action:'inspect',invoiceId},controller.signal);
      if(!controller.signal.aborted)setReview(data);
    })().catch(()=>{if(!controller.signal.aborted){if(!verifiedInvoice)setContextFailed(true);setMessage(verifiedInvoice?'Xero details could not be loaded. Use Check Xero records to try again. Nothing has been changed.':'Invoice details could not be loaded. Retry this page. No Xero details have been changed.');}})
      .finally(()=>{if(!controller.signal.aborted){busy.current=false;setPending(false);}});
    return () => controller.abort();
  }, [invoiceId,contextRead,initialContext,inspectLoader]);
  async function run(action: () => Promise<void>) {
    if (busy.current) return; busy.current = true; setPending(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm the mapping.'); }
    finally { busy.current = false; setPending(false); }
  }
  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!context)return; const name = String(new FormData(event.currentTarget).get('contactName') ?? '').trim();
    void run(async () => { setSaved(false); setReview(null); setReview(await inspectLoader({ action: 'inspect', invoiceId, ...(name ? { contactName: name } : {}) })); });
  }
  function save(kind: 'customer' | 'defaults', event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (readOnly||!review) return;
    const data = new FormData(event.currentTarget); if (data.get('confirmed') !== 'on') return;
    const selection = { invoiceId, sourceContactId: review.context.sourceContactId, ...(kind === 'customer' ? { action: 'confirmCustomer', contactId: data.get('contactId') } : { action: 'confirmDefaults', accountCode: data.get('accountCode'), taxType: data.get('taxType') }) };
    const key = JSON.stringify(selection);
    if (attempt.current?.selection !== key) attempt.current = { selection: key, commandId: crypto.randomUUID() };
    const commandId = attempt.current.commandId;
    void run(async () => { await command({ ...selection, commandId, confirmed: true });
      setSaved(true);
      if (kind === 'customer') {
        const contact = review.contacts.find(item => item.id === data.get('contactId'));
        if (contact) setReview({ ...review, savedLink: { contactId: contact.id, contact, verifiedAt: new Date().toISOString() } });
      }
      setMessage(kind === 'customer' ? 'Customer link saved. Company accounting defaults are unchanged. No invoice was posted or payment approved.' : 'Company defaults saved for future transfers. Customer links and existing invoices are unchanged.');
      if (kind === 'defaults') { const tax = review.taxes.find(item => item.type === data.get('taxType')); if (tax) setReview({ ...review, defaults: { accountCode: String(data.get('accountCode')), taxType: tax.type, effectiveRate: tax.effectiveRate } }); } });
  }
  function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (readOnly||!review) return;
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
    <h2>{review?.context||context?<>{(review?.context??context)!.invoiceRef} — {(review?.context??context)!.customerName}</>:contextFailed?'Invoice unavailable':'Reading invoice details…'}</h2>
    <p>We check Xero for this customer automatically. Checking records does not save a link or change an invoice.</p>
    {pending&&!review&&<p role="status">{context?'Checking customer and accounting details in Xero…':'Reading the verified portal invoice…'}</p>}
    {contextFailed&&<a href={`/staff/payments/mapping?invoice=${invoiceId}`}>Try again</a>}
    <form onSubmit={inspect}><label>Xero customer name, if different <Input name="contactName" maxLength={240}  /></label>{' '}
      <Button type="submit" variant="secondary" disabled={pending||!context}>Check Xero records</Button></form>
    {message && <p role="status">{message}</p>}
    {canResumeTransfer && <button disabled={pending||readOnly} onClick={() => {if(readOnly)return;void run(async () => {
      const result = await command({ action: 'resume', invoiceId, confirmed: true });
      setMessage(result.state === 'queued' ? 'The existing invoice transfer is queued. Check finance review for its result.' : 'This transfer is already queued or running. Check finance review for its result.');
    });}}>Resume existing invoice transfer</button>}
    <section>
      {review&&<>
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
        <label><input type="checkbox" name="confirmed" required checked={contactConfirmed} onChange={event=>setContactConfirmed(event.target.checked)} disabled={!review||pending} /> I checked for an existing Xero customer and want to create this customer.</label>{' '}
        <button disabled={pending||readOnly}>Create Xero customer</button>
      </form>}
      </>}
      <form onSubmit={event => save('customer', event)} style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <label>Xero customer<Select name="contactId" required value={selectedContact} onChange={event=>setSelectedContact(event.target.value)} disabled={!review||pending}><option value="" disabled>Select customer</option>{review?.contacts.map(item => <option key={item.id} value={item.id}>{item.name}{item.email ? ` — ${item.email}` : ''}</option>)}</Select></label>
        <label><input type="checkbox" name="confirmed" required checked={contactConfirmed} onChange={event=>setContactConfirmed(event.target.checked)} disabled={!review||pending} /> I checked that this is the correct Xero customer.</label>
        <Button type="submit" disabled={readOnly||pending||!review||review.limited||!review.contacts.length}>Save customer link</Button>
      </form>
      <AccountingDefaults readOnly={readOnly} reviewKey={review?.checkedAt??''} known={Boolean(review)} value={review?.defaults??null} accounts={review?.accounts??[]} taxes={review?.taxes??[]} pending={pending} onSubmit={event => save('defaults', event)} />
    </section>
  </div>;
}
