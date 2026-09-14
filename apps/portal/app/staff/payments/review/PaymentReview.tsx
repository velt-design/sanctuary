'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import type { PilotMatch, PilotReview, PilotSuggestion } from '@/lib/xero/pilotTypes';
import ReviewNote from './ReviewNote';

const money = (cents: number) => new Intl.NumberFormat('en-NZ', {style:'currency', currency:'NZD'}).format(cents / 100);
const recoveryKey = 'sanctuary.deposit-review.pending-id';
async function command<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/payments/xero', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The result could not be confirmed. Check payment history before retrying.');
  return result as T;
}
export default function PaymentReview() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<PilotReview | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  useEffect(() => { try { setRecoveryId(sessionStorage.getItem(recoveryKey)); } catch { /* Status can also be checked in invoice history. */ } }, []);
  function remember(id: string | null) {
    setRecoveryId(id);
    try { if (id) sessionStorage.setItem(recoveryKey,id); else sessionStorage.removeItem(recoveryKey); } catch { /* Never block a verified result on browser storage. */ }
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The result could not be confirmed. Check payment history.'); }
    finally { busy.current = false; setPending(false); }
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void run(async () => {
      setResult(null);
      setResult(await command<PilotReview>({action:'review',invoiceRef:data.get('invoiceRef'),contactName:data.get('contactName')}));
    });
  }
  function approve(item: PilotSuggestion) {
    if (!item.approvalId || !item.approvalToken) return;
    void run(async () => {
      remember(item.approvalId);
      await command({action:'approve',confirmed:true,approvalToken:item.approvalToken});
      remember(null); setResult(null);
      setNotice(`Deposit recorded: ${money(item.amountCents!)}. Customer won. Search the invoice again to see the updated balance and history.`);
    });
  }
  function checkStatus() {
    void run(async () => {
      const status = await command<{match:PilotMatch|null}>({action:'status',approvalId:recoveryId});
      if (status.match) {
        remember(null); setResult(null);
        setNotice(status.match.reversedAt ? 'That deposit match was recorded and later reversed. Review current payment history.' : `Already recorded: ${money(status.match.amountCents)}. Do not record it again. Search the invoice to refresh its balance.`);
      } else setNotice('No completed match was found for this approval yet. A request may still be finishing. Check again or retry the same approval; do not add a manual payment.');
    });
  }
  function reverse(event: FormEvent<HTMLFormElement>, match: PilotMatch) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    if (data.get('confirmed') !== 'on') return;
    void run(async () => {
      await command({action:'reverse',confirmed:true,matchId:match.id,reason:data.get('reason')});
      setResult(null); setNotice('The portal match was reversed and its correction recorded. Xero is unchanged. Review the invoice again before assigning the receipt elsewhere.');
    });
  }
  return <div style={{display:'grid',gap:20}}>
    <p>Any verified positive deposit counts as a customer win. The requested deposit can still be partly unpaid. Approval records an existing receipt in the portal; it does not create money in Xero.</p>
    {recoveryId && <Card title="Check your last approval">
      <p>An approval may have completed without a browser response. Check its result before recording any payment manually.</p>
      <Button variant="secondary" disabled={pending} onClick={checkStatus}>Check approval result</Button>
    </Card>}
    <Card title="Find a deposit">
      <form onSubmit={review} style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'end'}}>
        <label>Portal invoice number<br/><input name="invoiceRef" placeholder="INV-0033" required pattern="INV-[0-9]{1,12}" disabled={pending}/></label>
        <label>Xero customer name (optional)<br/><input name="contactName" placeholder="Use invoice customer name" maxLength={240} disabled={pending}/></label>
        <Button type="submit" disabled={pending}>Find receipts</Button>
      </form>
    </Card>
    {pending && <p role="status">Checking the records. Please keep this page open.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {result && <>
      <Card title={`${result.context.invoice.projectName || result.context.invoice.customerName} — ${result.context.invoice.invoiceRef}`}>
        <p><strong>{result.context.customerWon ? 'Customer won — verified deposit recorded' : 'No active verified deposit match recorded'}</strong></p>
        <p>Requested deposit: {money(result.context.invoice.totalIncGstCents)} · Matched receipts: {money(result.context.matchedCents)} · Remaining: {money(result.context.invoice.totalIncGstCents-result.context.matchedCents)}</p>
        <p>Whole invoice status: {result.context.invoice.status}. These figures cover this invoice’s Xero matches; check other payment history where flagged.</p>
        <a href={`/staff/projects/proj_${result.context.invoice.projectId}?tab=invoices`}>Open project invoices and payment history</a>
        <p>Checked {new Date(result.checkedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} (New Zealand time).</p>
        {result.limited && <p role="alert">This is a limited search, not a complete accounting history. Check Xero for other receipts.</p>}
      </Card>
      {!result.suggestions.length && <p>No receipts found for this contact. This does not prove the customer has not paid.</p>}
      {result.suggestions.map(item => <Card key={item.receipt.id} title={`${item.receipt.contact} — ${item.amountCents === null ? 'Amount unavailable' : money(item.amountCents)}`}>
        <p>{item.receipt.date.slice(0,10)} · {item.receipt.currency} · {item.receipt.status} · Reconciled: {item.receipt.reconciled === true ? 'Yes' : 'No / unknown'}</p>
        <p>Reference: {item.receipt.reference || 'Not supplied by Xero'}</p>
        <details><summary>Receipt identity</summary><p style={{overflowWrap:'anywhere'}}>{item.receipt.id}</p></details>
        <ul>{item.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <ReviewNote receiptId={item.receipt.id} notes={result.notes} pending={pending} onSave={(id,disposition,reason)=>{
          void run(async()=>{
            await command({action:'note',noteId:id,receiptId:item.receipt.id,invoiceId:result.context.invoice.id,disposition,reason});
            setResult(null);setNotice('Review note saved. Search the invoice again to see the recorded decision. No payment was changed.');
          });
        }}/>
        {item.blockers.length ? <><strong>Investigation required</strong><ul>{item.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></> : <>
          <p>Approving this receipt will record {money(item.amountCents!)} against {result.context.invoice.invoiceRef}, count the customer as won, and leave {money(item.depositRemainingIfApprovedCents!)} of the requested deposit unpaid.</p>
          <form onSubmit={event => {event.preventDefault(); if (new FormData(event.currentTarget).get('confirmed') === 'on') approve(item);}}>
            <label><input type="checkbox" name="confirmed" required disabled={pending}/> I checked the payment evidence and any earlier review notes, resolved any concerns, and confirm this receipt belongs to this project and invoice.</label>
            <p><Button type="submit" disabled={pending || !item.approvalToken}>Approve this deposit match</Button></p>
          </form>
        </>}
      </Card>)}
      <Card title="Recorded match history">
        {!result.matches.length && <p>No Xero deposit matches recorded for this invoice.</p>}
        {result.matches.map(match => <article key={match.id}>
          <p><strong>{money(match.amountCents)}</strong> · Receipt {match.receiptDate} · {match.reversedAt ? 'Reversed' : 'Recorded'}</p>
          <p>Approved {new Date(match.approvedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} (New Zealand time).</p>
          {!match.reversedAt && <details><summary>Correct this match</summary>
            <p>This removes the portal match with an audited reversal. It does not refund the customer or alter Xero. A fully paid invoice may reopen.</p>
            <form onSubmit={event => reverse(event,match)}>
              <label>Reason<br/><textarea name="reason" required minLength={3} maxLength={1000} disabled={pending}/></label>
              <p><label><input type="checkbox" name="confirmed" required disabled={pending}/> I confirm this portal match should be reversed.</label></p>
              <Button variant="destructive" type="submit" disabled={pending}>Reverse this match</Button>
            </form>
          </details>}
        </article>)}
      </Card>
    </>}
  </div>;
}
